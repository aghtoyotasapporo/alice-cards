// app.js
// ありすばカード アプリケーションロジック

// グローバル状態管理
let currentUser = localStorage.getItem('alice_cards_username') || '';
let cardsData = [];
let croppedTemplateUrl = 'assets/original_card.jpg'; // 原本JPG画像を直接使用
let currentFilter = 'active'; // 'active' (30日以内) または 'all'
let currentView = 'board'; // 'board' (3Dコルクボード) または 'list' (フラットリスト表示)

// 3D掲示板のカメラ（操作）パラメータ
let panX = 100;
let panY = 100;
let zoom = 0.8;
let isDragging = false;
let startX, startY;

// Supabase設定の検出と初期化 (supabase-config.js の値を確認)
const useCloudDb = (window.SUPABASE_URL && window.SUPABASE_URL !== 'YOUR_SUPABASE_URL' && window.SUPABASE_ANON_KEY && window.SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY');
let supabase = null;
if (useCloudDb) {
  try {
    supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    console.log('Supabase クラウドデータベースモードで起動しました。');
  } catch (e) {
    console.error('Supabase の初期化に失敗しました。ローカルモードで動作します:', e);
  }
} else {
  console.log('ローカル API モード（messages.json）で起動しました。');
}

// DOM要素の取得
const boardViewport = document.getElementById('board-viewport');
const boardSurface = document.getElementById('board-surface');
const cardsLayer = document.getElementById('cards-layer');
const boardListView = document.getElementById('board-list-view');
const listCardsLayer = document.getElementById('list-cards-layer');
const zoomControlsGroup = document.getElementById('zoom-controls-group');
const boardInstructions = document.querySelector('.board-instructions');
const btnViewBoard = document.getElementById('ctrl-view-board');
const btnViewList = document.getElementById('ctrl-view-list');

const modalUser = document.getElementById('modal-user');
const inputUsername = document.getElementById('input-username');
const btnSaveUser = document.getElementById('btn-save-user');
const userDisplay = document.getElementById('user-display');

const modalEditor = document.getElementById('modal-editor');
const cardForm = document.getElementById('card-form');
const editorTitle = document.getElementById('editor-title');
const btnWrite = document.getElementById('btn-write');
const btnCloseEditor = document.getElementById('btn-close-editor');
const btnCancelEditor = document.getElementById('btn-cancel-editor');
const btnSubmitCard = document.getElementById('btn-submit-card');
const submitText = document.getElementById('submit-text');

const modalDetail = document.getElementById('modal-detail');
const btnCloseDetail = document.getElementById('btn-close-detail');

// エディター入力コントロール
const formRecipient = document.getElementById('form-recipient');
const formDepartment = document.getElementById('form-department');
const formMessage = document.getElementById('form-message');
const formSender = document.getElementById('form-sender');
const formDate = document.getElementById('form-date');
const charCount = document.getElementById('char-count');

// リアルタイムプレビュー用表示要素
const previewRecipient = document.getElementById('preview-recipient');
const previewCheckThank = document.getElementById('preview-check-thank');
const previewCheckAwesome = document.getElementById('preview-check-awesome');
const previewMessage = document.getElementById('preview-message');
const previewDateYear = document.getElementById('preview-date-year');
const previewDateMonth = document.getElementById('preview-date-month');
const previewDateDay = document.getElementById('preview-date-day');
const previewDepartment = document.getElementById('preview-department');
const previewSender = document.getElementById('preview-sender');
const previewTemplateImg = document.getElementById('preview-template-img');

// 詳細表示用表示要素
const detailRecipient = document.getElementById('detail-recipient');
const detailCheckThank = document.getElementById('detail-check-thank');
const detailCheckAwesome = document.getElementById('detail-check-awesome');
const detailMessage = document.getElementById('detail-message');
const detailDateYear = document.getElementById('detail-date-year');
const detailDateMonth = document.getElementById('detail-date-month');
const detailDateDay = document.getElementById('detail-date-day');
const detailDepartment = document.getElementById('detail-department');
const detailSender = document.getElementById('detail-sender');
const detailTemplateImg = document.getElementById('detail-template-img');
const detailMetaCreator = document.getElementById('detail-meta-creator');
const detailMetaCreatedAt = document.getElementById('detail-meta-createdat');
const detailMetaStatus = document.getElementById('detail-meta-status');
const detailOwnerControls = document.getElementById('detail-owner-controls');

// ダウンロード/操作アクション
const btnDetailDownloadPrint = document.getElementById('btn-detail-download-print');
const btnDetailDownloadFull = document.getElementById('btn-detail-download-full');
const btnDetailEdit = document.getElementById('btn-detail-edit');
const btnDetailDelete = document.getElementById('btn-detail-delete');

let selectedDetailedCard = null;

// アプリケーション初期化
window.addEventListener('DOMContentLoaded', async () => {
  // Lucideアイコンの読み込み
  lucide.createIcons();
  
  // ユーザー名の読み込みと表示
  updateUserUI();

  // イベントリスナーの登録
  initEventListeners();

  // 原本画像のロード
  try {
    await initializeTemplateFromJpg();
  } catch (error) {
    console.error('テンプレート画像のロード中にエラーが発生しました:', error);
    alert('原本画像 (original_card.jpg) の読み込みに失敗しました。');
  }
});

// ユーザー名のUI更新
function updateUserUI() {
  if (currentUser) {
    const isAdmin = localStorage.getItem('alice_cards_is_admin') === 'true';
    userDisplay.textContent = isAdmin ? `👤 (管理者) ${currentUser}` : `👤 ${currentUser}`;
    formSender.value = currentUser;
    modalUser.classList.remove('active');
  } else {
    userDisplay.textContent = '未登録';
    modalUser.classList.add('active');
    inputUsername.focus();
  }
}

// イベントリスナー登録
function initEventListeners() {
  // ユーザー登録関連
  inputUsername.addEventListener('input', () => {
    btnSaveUser.disabled = inputUsername.value.trim().length === 0;
  });
  
  btnSaveUser.addEventListener('click', () => {
    const name = inputUsername.value.trim();
    if (name) {
      currentUser = name;
      localStorage.setItem('alice_cards_username', name);
      
      const passcode = document.getElementById('input-admin-passcode').value.trim();
      if (passcode === 'aliceadmin') {
        localStorage.setItem('alice_cards_is_admin', 'true');
        localStorage.setItem('alice_cards_admin_passcode', 'aliceadmin');
      } else {
        localStorage.removeItem('alice_cards_is_admin');
        localStorage.removeItem('alice_cards_admin_passcode');
      }
      
      updateUserUI();
      fetchCards();
    }
  });

  userDisplay.addEventListener('click', () => {
    inputUsername.value = currentUser;
    document.getElementById('input-admin-passcode').value = localStorage.getItem('alice_cards_admin_passcode') || '';
    btnSaveUser.disabled = false;
    modalUser.classList.add('active');
    inputUsername.focus();
  });

  // 掲示板移動・ズーム関連
  boardViewport.addEventListener('mousedown', startPan);
  window.addEventListener('mousemove', panBoard);
  window.addEventListener('mouseup', endPan);

  // タッチ操作（モバイル）
  boardViewport.addEventListener('touchstart', startPanTouch, { passive: false });
  boardViewport.addEventListener('touchmove', panBoardTouch, { passive: false });
  boardViewport.addEventListener('touchend', endPan);

  // ホイールズーム
  boardViewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = 1.08;
    if (e.deltaY < 0) {
      zoom = Math.min(zoom * zoomFactor, 2.0);
    } else {
      zoom = Math.max(zoom / zoomFactor, 0.35);
    }
    updateBoardTransform();
  }, { passive: false });

  // コントローラーボタン
  document.getElementById('ctrl-zoom-in').addEventListener('click', () => {
    zoom = Math.min(zoom * 1.2, 2.0);
    updateBoardTransform();
  });
  document.getElementById('ctrl-zoom-out').addEventListener('click', () => {
    zoom = Math.max(zoom / 1.2, 0.35);
    updateBoardTransform();
  });
  document.getElementById('ctrl-zoom-reset').addEventListener('click', () => {
    zoom = 0.8;
    panX = (boardViewport.clientWidth - 3000 * zoom) / 2;
    panY = (boardViewport.clientHeight - 2000 * zoom) / 2;
    updateBoardTransform();
  });

  // フィルターボタン
  const filterActiveBtn = document.getElementById('ctrl-filter-active');
  const filterAllBtn = document.getElementById('ctrl-filter-all');
  
  filterActiveBtn.addEventListener('click', () => {
    currentFilter = 'active';
    filterActiveBtn.classList.add('active');
    filterAllBtn.classList.remove('active');
    renderCards();
  });

  filterAllBtn.addEventListener('click', () => {
    currentFilter = 'all';
    filterAllBtn.classList.add('active');
    filterActiveBtn.classList.remove('active');
    renderCards();
  });

  // 表示切替ボタン
  btnViewBoard.addEventListener('click', () => {
    if (currentView === 'board') return;
    currentView = 'board';
    btnViewBoard.classList.add('active');
    btnViewList.classList.remove('active');
    
    // コルクボードの木枠と背景を復活させる
    document.querySelector('.board-container').classList.remove('list-view-active');
    
    zoomControlsGroup.style.display = 'flex';
    boardInstructions.style.display = 'block';
    boardViewport.style.display = 'block';
    boardListView.style.display = 'none';
    
    renderCards();
  });

  btnViewList.addEventListener('click', () => {
    if (currentView === 'list') return;
    currentView = 'list';
    btnViewList.classList.add('active');
    btnViewBoard.classList.remove('active');
    
    // コルクボードの木枠と背景を消し、すっきり表示にする
    document.querySelector('.board-container').classList.add('list-view-active');
    
    zoomControlsGroup.style.display = 'none';
    boardInstructions.style.display = 'none';
    boardViewport.style.display = 'none';
    boardListView.style.display = 'block';
    
    renderCards();
  });

  // 新規作成エディター関連
  btnWrite.addEventListener('click', () => openEditor());
  btnCloseEditor.addEventListener('click', () => modalEditor.classList.remove('active'));
  btnCancelEditor.addEventListener('click', () => modalEditor.classList.remove('active'));
  
  // フォームリアルタイム同期
  formRecipient.addEventListener('input', syncPreview);
  formDepartment.addEventListener('input', syncPreview);
  formMessage.addEventListener('input', syncPreview);
  formDate.addEventListener('change', syncPreview);
  
  document.querySelectorAll('input[name="category"]').forEach(radio => {
    radio.addEventListener('change', syncPreview);
  });

  document.getElementById('form-font').addEventListener('change', syncPreview);
  document.querySelectorAll('input[name="textColor"]').forEach(radio => {
    radio.addEventListener('change', syncPreview);
  });

  // カード投稿・編集保存
  btnSubmitCard.addEventListener('click', submitCard);

  // 詳細モーダルクローズ
  btnCloseDetail.addEventListener('click', () => modalDetail.classList.remove('active'));

  // 詳細画面での操作
  btnDetailDownloadPrint.addEventListener('click', () => downloadCardPdf(selectedDetailedCard, false));
  btnDetailDownloadFull.addEventListener('click', () => downloadCardPdf(selectedDetailedCard, true));
  btnDetailEdit.addEventListener('click', () => editCard(selectedDetailedCard));
  btnDetailDelete.addEventListener('click', () => deleteCard(selectedDetailedCard));
}

// 掲示板ドラッグ移動の処理 (マウス)
function startPan(e) {
  if (e.target.closest('.card-item') || e.target.closest('button')) return;
  isDragging = true;
  startX = e.clientX - panX;
  startY = e.clientY - panY;
  boardViewport.style.cursor = 'grabbing';
}

function panBoard(e) {
  if (!isDragging) return;
  panX = e.clientX - startX;
  panY = e.clientY - startY;
  updateBoardTransform();
}

// 掲示板ドラッグ移動の処理 (タッチ・モバイル対応)
function startPanTouch(e) {
  if (e.target.closest('.card-item') || e.target.closest('button')) return;
  isDragging = true;
  startX = e.touches[0].clientX - panX;
  startY = e.touches[0].clientY - panY;
}

function panBoardTouch(e) {
  if (!isDragging) return;
  e.preventDefault();
  panX = e.touches[0].clientX - startX;
  panY = e.touches[0].clientY - startY;
  updateBoardTransform();
}

function endPan() {
  isDragging = false;
  boardViewport.style.cursor = 'grab';
}

// 掲示板の3D変形を適用
function updateBoardTransform() {
  boardSurface.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${zoom})`;
}

// --- 原本画像の読み込みと初期化 ---
async function initializeTemplateFromJpg() {
  const loadingOverlay = document.getElementById('loading-overlay');
  
  try {
    // プレビューおよび詳細表示用テンプレート画像のソース更新
    previewTemplateImg.src = croppedTemplateUrl;
    detailTemplateImg.src = croppedTemplateUrl;
    
    // 画像ロード待機
    const img = new Image();
    img.src = croppedTemplateUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    // 初期ロードのフェッチ
    await fetchCards();
    
    // 初期表示のパン位置を設定 (画面中央にボードを置く)
    panX = (boardViewport.clientWidth - 3000 * zoom) / 2;
    panY = (boardViewport.clientHeight - 2000 * zoom) / 2;
    updateBoardTransform();

    // ローディング終了
    loadingOverlay.classList.remove('active');
  } catch (error) {
    console.error('テンプレート画像の読み込み失敗:', error);
    loadingOverlay.innerHTML = `
      <div class="loading-spinner-container">
        <p style="color: #ef4444; font-weight: bold;">原本テンプレート画像の読み込みに失敗しました。</p>
        <p style="font-size: 12px; color: var(--text-muted);">
          C:\\Users\\itc2024\\OneDrive\\alice-cards\\web\\assets\\original_card.jpg<br>
          ファイルが正しく配置されているか確認してください。
        </p>
      </div>`;
    throw error;
  }
}

// --- API連携 (メッセージ取得・送信・編集・削除) ---

// カード取得
async function fetchCards() {
  try {
    if (supabase) {
      // Supabaseクラウドデータベースから取得
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .order('createdAt', { ascending: true });
      if (error) throw error;
      cardsData = data || [];
    } else {
      // ローカル API から取得
      const res = await fetch('/api/cards');
      if (!res.ok) throw new Error('API error');
      cardsData = await res.json();
    }
    renderCards();
  } catch (err) {
    console.error('カードデータの取得に失敗しました:', err);
  }
}

// 単一のカードDOM要素を生成するヘルパー関数
function createCardElement(card) {
  const now = new Date();
  const createdAtDate = new Date(card.createdAt);
  const diffTime = Math.abs(now - createdAtDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const isExpired = diffDays > 30;

  const cardEl = document.createElement('div');
  cardEl.className = 'card-item';
  if (isExpired) {
    cardEl.classList.add('expired-card');
  }
  if (isLatestDailyCard(card.createdAt)) {
    cardEl.classList.add('latest-daily');
  }

  // 日付を年、月、日に分割
  const dateParts = (card.date || '').split('-');
  const yearStr = dateParts[0] || '';
  const monthStr = dateParts[1] ? parseInt(dateParts[1], 10).toString() : '';
  const dayStr = dateParts[2] ? parseInt(dateParts[2], 10).toString() : '';

  // カードのHTML構造
  cardEl.innerHTML = `
    <div class="card-render-box">
      <img src="${croppedTemplateUrl}" alt="Card">
      <div class="card-overlay recipient-overlay">${escapeHtml(card.recipient)}</div>
      <div class="card-overlay checkbox-thank-overlay">${card.category === 'thank_you' ? '✔' : ''}</div>
      <div class="card-overlay checkbox-awesome-overlay">${card.category === 'awesome' ? '✔' : ''}</div>
      <div class="card-overlay message-overlay">${escapeHtml(card.message)}</div>
      <div class="card-overlay date-year-overlay">${yearStr}</div>
      <div class="card-overlay date-month-overlay">${monthStr}</div>
      <div class="card-overlay date-day-overlay">${dayStr}</div>
      <div class="card-overlay department-overlay">${escapeHtml(card.department || '')}</div>
      <div class="card-overlay sender-overlay">${escapeHtml(card.sender)}</div>
      ${isExpired ? '<div class="expired-stamp">1ヶ月経過</div>' : ''}
    </div>
  `;

  // 書体・色の反映
  const overlays = cardEl.querySelectorAll('.card-overlay:not(.checkbox-thank-overlay):not(.checkbox-awesome-overlay)');
  overlays.forEach(el => {
    el.style.fontFamily = `"${card.fontFamily || 'Yusei Magic'}", var(--font-write)`;
    el.style.color = card.textColor || '#111111';
  });

  // クリックで詳細表示
  cardEl.addEventListener('click', (e) => {
    e.stopPropagation();
    showCardDetail(card);
  });

  return cardEl;
}

// 掲示板またはリストへのカード描画
function renderCards() {
  cardsLayer.innerHTML = '';
  listCardsLayer.innerHTML = '';

  const now = new Date();
  
  // フィルターされたカードデータを準備
  const filteredCards = cardsData.filter(card => {
    if (currentFilter === 'active') {
      const createdAtDate = new Date(card.createdAt);
      const diffTime = Math.abs(now - createdAtDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 30; // 30日以内のものだけ
    }
    return true;
  });

  if (filteredCards.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'board-empty-message';
    emptyMsg.innerHTML = '<p>掲示板にカードがありません。<br>「カードを書く」から感謝のメッセージを送りましょう！</p>';
    
    if (currentView === 'board') {
      emptyMsg.style.position = 'absolute';
      emptyMsg.style.left = '1200px';
      emptyMsg.style.top = '850px';
      emptyMsg.style.fontSize = '24px';
      emptyMsg.style.color = 'var(--text-muted)';
      emptyMsg.style.textAlign = 'center';
      cardsLayer.appendChild(emptyMsg);
    } else {
      emptyMsg.style.fontSize = '20px';
      emptyMsg.style.color = 'var(--text-muted)';
      emptyMsg.style.textAlign = 'center';
      emptyMsg.style.margin = '100px auto';
      listCardsLayer.appendChild(emptyMsg);
    }
    return;
  }

  if (currentView === 'board') {
    // 掲示板（3D）表示
    const colWidth = 460;
    const rowHeight = 330;
    const startColX = 350;
    const startRowY = 250;
    const colsCount = 5;

    filteredCards.forEach((card, index) => {
      const cardEl = createCardElement(card);
      
      const col = index % colsCount;
      const row = Math.floor(index / colsCount);
      
      // 決定論的なランダム値を生成 (カードIDに基づく)
      const seed = parseInt(card.id.substring(card.id.length - 4)) || index;
      const randTilt = ((seed % 6) - 3); // -3deg ~ +3deg
      const randOffsetX = ((seed % 30) - 15); // -15px ~ +15px
      const randOffsetY = ((seed % 20) - 10); // -10px ~ +10px

      const posX = startColX + col * colWidth + randOffsetX;
      const posY = startRowY + row * rowHeight + randOffsetY;

      cardEl.style.left = `${posX}px`;
      cardEl.style.top = `${posY}px`;
      cardEl.style.transform = `translate3d(0, 0, 0) rotateZ(${randTilt}deg)`;

      cardsLayer.appendChild(cardEl);
    });
  } else {
    // リスト（フラット）表示
    filteredCards.forEach((card) => {
      const cardEl = createCardElement(card);
      const wrapperEl = document.createElement('div');
      wrapperEl.className = 'list-card-wrapper';
      wrapperEl.appendChild(cardEl);
      listCardsLayer.appendChild(wrapperEl);
    });
  }
}

// エディターを開く
function openEditor(card = null) {
  if (!currentUser) {
    modalUser.classList.add('active');
    return;
  }

  // フォームリセット
  cardForm.reset();
  formSender.value = currentUser;
  
  if (card) {
    // 編集モード
    editorTitle.textContent = 'ありすばカードを編集する';
    submitText.textContent = '変更を保存する';
    document.getElementById('card-edit-id').value = card.id;
    formRecipient.value = card.recipient;
    formDepartment.value = card.department || '';
    formMessage.value = card.message;
    formDate.value = card.date;
    
    document.querySelectorAll('input[name="category"]').forEach(radio => {
      radio.checked = radio.value === card.category;
    });

    document.getElementById('form-font').value = card.fontFamily || 'Yusei Magic';
    const colorRadio = document.querySelector(`input[name="textColor"][value="${card.textColor || '#111111'}"]`);
    if (colorRadio) colorRadio.checked = true;
  } else {
    // 新規作成モード
    editorTitle.textContent = 'ありすばカードを書く';
    submitText.textContent = '送信する';
    document.getElementById('card-edit-id').value = '';
    
    const today = new Date().toISOString().split('T')[0];
    formDate.value = today;

    document.getElementById('form-font').value = 'Yusei Magic';
    const blackRadio = document.querySelector('input[name="textColor"][value="#111111"]');
    if (blackRadio) blackRadio.checked = true;
  }

  syncPreview();
  modalEditor.classList.add('active');
}

// プレビュー画面の更新
function syncPreview() {
  const recipient = formRecipient.value.trim() || '（宛先）';
  const department = formDepartment.value.trim() || '（部署）';
  const message = formMessage.value.trim() || 'ここに感謝・称賛メッセージが入ります。';
  const sender = formSender.value.trim() || currentUser;
  const dateStr = formDate.value;
  const category = document.querySelector('input[name="category"]:checked')?.value || 'thank_you';

  charCount.textContent = formMessage.value.length;

  // プレビューDOMの更新
  previewRecipient.textContent = recipient;
  previewDepartment.textContent = department;
  previewMessage.textContent = message;
  previewSender.textContent = sender;

  // 日付の分割同期
  const dateParts = (dateStr || '').split('-');
  if (dateParts.length === 3) {
    previewDateYear.textContent = dateParts[0];
    previewDateMonth.textContent = parseInt(dateParts[1], 10).toString();
    previewDateDay.textContent = parseInt(dateParts[2], 10).toString();
  } else {
    previewDateYear.textContent = '';
    previewDateMonth.textContent = '';
    previewDateDay.textContent = '';
  }

  previewCheckThank.textContent = category === 'thank_you' ? '✔' : '';
  previewCheckAwesome.textContent = category === 'awesome' ? '✔' : '';

  // 書体と色の反映
  const fontFamily = document.getElementById('form-font').value;
  const textColor = document.querySelector('input[name="textColor"]:checked')?.value || '#111111';
  const previewRenderBox = document.getElementById('card-preview-render');
  const overlays = previewRenderBox.querySelectorAll('.card-overlay:not(.checkbox-thank-overlay):not(.checkbox-awesome-overlay)');
  overlays.forEach(el => {
    el.style.fontFamily = `"${fontFamily}", var(--font-write)`;
    el.style.color = textColor;
  });
}

// 日本語日付フォーマット (YYYY-MM-DD -> YYYY年 M月 D日)
function formatJapaneseDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  return `${year}年 ${month}月 ${day}日`;
}

// カードの送信（新規または編集）
async function submitCard(e) {
  e.preventDefault();

  if (!cardForm.checkValidity()) {
    cardForm.reportValidity();
    return;
  }

  const editId = document.getElementById('card-edit-id').value;
  const category = document.querySelector('input[name="category"]:checked').value;
  const recipient = formRecipient.value.trim();
  const department = formDepartment.value.trim();
  const message = formMessage.value.trim();
  const sender = formSender.value.trim();
  const date = formDate.value;

  const fontFamily = document.getElementById('form-font').value;
  const textColor = document.querySelector('input[name="textColor"]:checked')?.value || '#111111';

  const adminPasscode = localStorage.getItem('alice_cards_admin_passcode') || '';
  const payload = {
    recipient,
    department,
    message,
    sender,
    date,
    category,
    fontFamily,
    textColor,
    creator: editId ? selectedDetailedCard.creator : currentUser,
    adminPasscode: adminPasscode
  };

  try {
    if (supabase) {
      if (editId) {
        // Supabaseで更新
        const { error } = await supabase
          .from('cards')
          .update({
            recipient: payload.recipient,
            department: payload.department,
            message: payload.message,
            sender: payload.sender,
            date: payload.date,
            category: payload.category,
            fontFamily: payload.fontFamily,
            textColor: payload.textColor
          })
          .eq('id', editId);
        if (error) throw error;
      } else {
        // Supabaseで新規作成
        const newCard = {
          id: Date.now().toString(),
          recipient: payload.recipient,
          department: payload.department,
          message: payload.message,
          sender: payload.sender,
          date: payload.date,
          category: payload.category,
          fontFamily: payload.fontFamily,
          textColor: payload.textColor,
          creator: payload.creator,
          createdAt: new Date().toISOString()
        };
        const { error } = await supabase
          .from('cards')
          .insert([newCard]);
        if (error) throw error;
      }
    } else {
      // ローカルAPI
      let res;
      if (editId) {
        res = await fetch(`/api/cards/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Request failed');
      }
    }

    modalEditor.classList.remove('active');
    await fetchCards();
    modalDetail.classList.remove('active');
  } catch (err) {
    console.error('送信エラー:', err);
    alert(`エラーが発生しました: ${err.message}`);
  }
}

// カード詳細ズーム画面の表示
function showCardDetail(card) {
  selectedDetailedCard = card;

  detailRecipient.textContent = card.recipient;
  detailCheckThank.textContent = card.category === 'thank_you' ? '✔' : '';
  detailCheckAwesome.textContent = card.category === 'awesome' ? '✔' : '';
  detailMessage.textContent = card.message;
  detailDepartment.textContent = card.department || '';
  detailSender.textContent = card.sender;

  // 日付の分割表示
  const dateParts = (card.date || '').split('-');
  if (dateParts.length === 3) {
    detailDateYear.textContent = dateParts[0];
    detailDateMonth.textContent = parseInt(dateParts[1], 10).toString();
    detailDateDay.textContent = parseInt(dateParts[2], 10).toString();
  } else {
    detailDateYear.textContent = '';
    detailDateMonth.textContent = '';
    detailDateDay.textContent = '';
  }

  // メタデータ
  detailMetaCreator.textContent = card.creator;
  
  const createdDate = new Date(card.createdAt);
  detailMetaCreatedAt.textContent = createdDate.toLocaleString('ja-JP');

  const now = new Date();
  const diffDays = Math.ceil(Math.abs(now - createdDate) / (1000 * 60 * 60 * 24));
  const isExpired = diffDays > 30;
  
  const statusBadge = detailMetaStatus;
  if (isExpired) {
    statusBadge.textContent = '掲載終了（アーカイブ）';
    statusBadge.className = 'info-val badge expired';
    statusBadge.style.background = 'rgba(140, 115, 106, 0.15)';
    statusBadge.style.color = 'var(--text-muted)';
  } else {
    statusBadge.textContent = `掲示中（残り ${30 - diffDays}日）`;
    statusBadge.className = 'info-val badge active';
    statusBadge.style.background = 'rgba(5, 150, 105, 0.12)';
    statusBadge.style.color = '#059669';
  }

  // 編集権限チェック (本人、または管理者は可能)
  const isAdmin = localStorage.getItem('alice_cards_is_admin') === 'true';
  if (isAdmin || card.creator === currentUser) {
    detailOwnerControls.style.display = 'grid';
  } else {
    detailOwnerControls.style.display = 'none';
  }

  const detailRenderBox = document.getElementById('card-detail-render');
  const overlays = detailRenderBox.querySelectorAll('.card-overlay:not(.checkbox-thank-overlay):not(.checkbox-awesome-overlay)');
  overlays.forEach(el => {
    el.style.fontFamily = `"${card.fontFamily || 'Yusei Magic'}", var(--font-write)`;
    el.style.color = card.textColor || '#111111';
  });

  modalDetail.classList.add('active');
}

// カード編集モードへ移行
function editCard(card) {
  modalDetail.classList.remove('active');
  openEditor(card);
}

// カード削除
async function deleteCard(card) {
  if (!confirm('このありすばカードを削除してもよろしいですか？')) return;

  try {
    if (supabase) {
      // Supabaseクラウドデータベースから削除
      const { error } = await supabase
        .from('cards')
        .delete()
        .eq('id', card.id);
      if (error) throw error;
    } else {
      // ローカル API から削除
      const adminPasscode = localStorage.getItem('alice_cards_admin_passcode') || '';
      const queryParams = new URLSearchParams({
        creator: currentUser,
        adminPasscode: adminPasscode
      });
      const res = await fetch(`/api/cards/${card.id}?${queryParams.toString()}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete');
      }
    }

    modalDetail.classList.remove('active');
    await fetchCards();
  } catch (err) {
    console.error('削除失敗:', err);
    alert(`削除に失敗しました: ${err.message}`);
  }
}

// --- PDFダウンロード生成処理 (Canvas描画 + PDF出力) ---
async function downloadCardPdf(card, includeBackground = false) {
  const loadingOverlay = document.getElementById('loading-overlay');
  const oldText = document.getElementById('loading-text').innerHTML;
  
  document.getElementById('loading-text').innerHTML = 'PDFファイルを生成しています...';
  loadingOverlay.classList.add('active');

  try {
    // 1. 高解像度Canvasの準備 (カード単体サイズ 1237 x 880)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const cardW = 1237;
    const cardH = 880;
    
    canvas.width = cardW;
    canvas.height = cardH;
    
    const pdfWidth = cardW / 3.0; // DPI補正でポイントサイズに変換
    const pdfHeight = cardH / 3.0;
    
    if (includeBackground) {
      // カード画像の読み込み
      const cardImg = new Image();
      cardImg.src = croppedTemplateUrl;
      await new Promise((resolve, reject) => {
        cardImg.onload = resolve;
        cardImg.onerror = reject;
      });
      ctx.drawImage(cardImg, 0, 0, cardW, cardH);
    } else {
      ctx.clearRect(0, 0, cardW, cardH);
    }

    // 2. 文字を描画 (選択された手書き風フォントを反映)
    const selectedFont = card.fontFamily || 'Yusei Magic';
    await document.fonts.load(`16px "${selectedFont}"`);
    
    ctx.fillStyle = card.textColor || '#111111'; // 選択された色（標準は黒）

    // 宛先 (さんへとライン左端の中央に配置)
    ctx.font = `${Math.round(cardH * 0.06)}px "${selectedFont}"`;
    ctx.textAlign = 'center';
    ctx.fillText(card.recipient, cardW * 0.43, cardH * 0.295);
    ctx.textAlign = 'left'; // リセット
    
    // カテゴリチェック (チェックマークは赤のままで描画)
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ff3333';
    if (card.category === 'thank_you') {
      drawCheckMark(ctx, cardW * 0.78, cardH * 0.19, 30);
    } else {
      drawCheckMark(ctx, cardW * 0.776, cardH * 0.262, 30);
    }
    
    // メッセージ (折り返し)
    ctx.font = `${Math.round(cardH * 0.043)}px "${selectedFont}"`;
    wrapCanvasText(ctx, card.message, cardW * 0.21, cardH * 0.465, cardW * 0.73, cardH * 0.075);
    
    // 日付 (年、月、日の分割配置)
    const dateParts = (card.date || '').split('-');
    const yearStr = dateParts[0] || '';
    const monthStr = dateParts[1] ? parseInt(dateParts[1], 10).toString() : '';
    const dayStr = dateParts[2] ? parseInt(dateParts[2], 10).toString() : '';

    ctx.font = `${Math.round(cardH * 0.042)}px "${selectedFont}"`;
    ctx.fillText(yearStr, cardW * 0.59, cardH * 0.795);
    ctx.fillText(monthStr, cardW * 0.785, cardH * 0.795);
    ctx.fillText(dayStr, cardW * 0.895, cardH * 0.795);

    // 所属・差出人 (Y座標を 0.935 から 0.938 に微調整)
    ctx.font = `${Math.round(cardH * 0.04)}px "${selectedFont}"`;
    ctx.fillText(card.department || '', cardW * 0.34, cardH * 0.938);
    ctx.textAlign = 'right';
    ctx.fillText(card.sender, cardW * 0.90, cardH * 0.938);
    ctx.textAlign = 'left'; // リセット

    // 3. CanvasをPNG画像DataURLへ変換
    const imgDataUrl = canvas.toDataURL('image/png');
    
    // 4. PDF-Libを用いたPDFファイルの作成
    const pdfDoc = await PDFLib.PDFDocument.create();
    const pdfPage = pdfDoc.addPage([pdfWidth, pdfHeight]);
    const pngImage = await pdfDoc.embedPng(imgDataUrl);
    
    pdfPage.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: pdfWidth,
      height: pdfHeight
    });
    
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `ありすばカード_${card.recipient}_${card.id}.pdf`;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

  } catch (error) {
    console.error('PDF生成エラー:', error);
    alert('PDFファイルの生成に失敗しました。');
  } finally {
    document.getElementById('loading-text').innerHTML = oldText;
    loadingOverlay.classList.remove('active');
  }
}

// チェックマークの手書き風描画ユーティリティ
function drawCheckMark(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x - size * 0.4, y - size * 0.1);
  ctx.lineTo(x - size * 0.1, y + size * 0.3);
  ctx.lineTo(x + size * 0.4, y - size * 0.4);
  ctx.stroke();
}

// Canvas用のメッセージ自動改行・行制限ユーティリティ (日本語文字単位、改行コード対応)
function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const paragraphs = text.split('\n');
  let lineCount = 0;

  for (let p = 0; p < paragraphs.length; p++) {
    const chars = paragraphs[p].split('');
    let line = '';
    
    for (let n = 0; n < chars.length; n++) {
      const testLine = line + chars[n];
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = chars[n];
        y += lineHeight;
        lineCount++;
        if (lineCount >= 4) {
          // 4行目に達した場合は、末尾に「…」を付与して終了
          ctx.clearRect(x, y - lineHeight, maxWidth, lineHeight);
          ctx.fillText(line.slice(0, -1) + '…', x, y - lineHeight);
          return;
        }
      } else {
        line = testLine;
      }
    }
    
    // 段落の残りのテキストを描画
    ctx.fillText(line, x, y);
    y += lineHeight;
    lineCount++;
    if (lineCount >= 4) {
      return;
    }
  }
}

// HTMLエスケープ処理
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#039;';
      default: return m;
    }
  });
}

// 当日のあさ8:50から翌日のあさ8:50までの最新カード判定
function isLatestDailyCard(createdAtString) {
  if (!createdAtString) return false;
  const cardDate = new Date(createdAtString);
  const now = new Date();
  
  // 今日のあさ8:50
  const startOfTodayWindow = new Date(now);
  startOfTodayWindow.setHours(8, 50, 0, 0);
  
  let windowStart, windowEnd;
  if (now < startOfTodayWindow) {
    // 現在時刻が今日のあさ8:50より前なら、対象期間は「昨日のあさ8:50 〜 今日のあさ8:50」
    windowStart = new Date(startOfTodayWindow);
    windowStart.setDate(windowStart.getDate() - 1);
    windowEnd = startOfTodayWindow;
  } else {
    // 現在時刻が今日のあさ8:50以降なら、対象期間は「今日のあさ8:50 〜 明日のあさ8:50」
    windowStart = startOfTodayWindow;
    windowEnd = new Date(startOfTodayWindow);
    windowEnd.setDate(windowEnd.getDate() + 1);
  }
  
  return cardDate >= windowStart && cardDate < windowEnd;
}
