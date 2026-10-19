/* ==========================================================================
   C-SLOT INTERACTIVE APP LOGIC & DOWNLOAD CONTROLLER
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // ------------------------------------------------------------------------
  // 1. STATE & SIMULATOR DATA
  // ------------------------------------------------------------------------
  const SLOT_COUNT = 9;
  
  const initialSlots = [
    'https://github.com/Md-Ruwaid/Ctrl-slot',
    'npm install koffi electron-builder',
    'SELECT id, email, created_at FROM users WHERE active = 1;',
    'SAMPLE_API_TOKEN_99480102b48fe2772',
    '#38bdf8 /* Electric Cyan */',
    'ruwaid@example.com',
    'const user32 = koffi.load("user32.dll");',
    'git commit -m "feat: ultra-fast 9-slot clipboard buffer"',
    'Ctrl+Alt+0 to toggle on/off'
  ];

  let simState = {
    enabled: true,
    next: 0,
    slots: [...initialSlots]
  };

  // DOM Elements - Simulator
  const hudList = document.getElementById('hudList');
  const hudPreview = document.getElementById('hudPreview');
  const hudStatus = document.getElementById('hudStatus');
  const simToggleState = document.getElementById('simToggleState');
  const simClearBtn = document.getElementById('simClearBtn');
  const simAddForm = document.getElementById('simAddForm');
  const simCustomInput = document.getElementById('simCustomInput');
  const simEditorBody = document.getElementById('simEditorBody');
  const sampleChips = document.querySelectorAll('.sample-chip');
  const numpadKeys = document.querySelectorAll('.key-cap');

  // DOM Elements - Download & Modal
  const downloadSetupBtns = document.querySelectorAll('.btn-download-setup');
  const downloadPortableBtns = document.querySelectorAll('.btn-download-portable');
  const dlModal = document.getElementById('downloadModal');
  const dlModalClose = document.getElementById('modalCloseBtn');
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const copyHashBtns = document.querySelectorAll('.hash-copy-btn');
  const faqItems = document.querySelectorAll('.faq-item');

  // ------------------------------------------------------------------------
  // 2. HUD SIMULATOR RENDERING
  // ------------------------------------------------------------------------
  function formatPreview(text) {
    if (!text) return 'Empty';
    const preview = text.length > 55 ? text.slice(0, 55) + '…' : text;
    return preview.replace(/\s+/g, ' ').trim();
  }

  function renderHud() {
    if (!hudList) return;
    
    hudList.innerHTML = '';
    hudPreview.classList.toggle('paused', !simState.enabled);
    hudStatus.textContent = simState.enabled ? 'Active' : 'Paused';
    
    if (simToggleState) {
      simToggleState.textContent = simState.enabled ? 'Active (HUD On)' : 'Paused (HUD Off)';
      simToggleState.classList.toggle('btn-primary', simState.enabled);
      simToggleState.classList.toggle('btn-secondary', !simState.enabled);
    }

    simState.slots.forEach((text, i) => {
      const li = document.createElement('li');
      li.className = 'hud-slot-row';
      li.dataset.slotIndex = i;

      const cap = document.createElement('span');
      cap.className = 'hud-slot-cap';
      cap.textContent = i + 1;

      const txt = document.createElement('span');
      txt.className = 'hud-slot-txt';
      txt.textContent = formatPreview(text);

      if (!text) {
        li.classList.add('empty');
      }
      if (i === simState.next && simState.enabled) {
        li.classList.add('next-target');
      }

      li.append(cap, txt);

      li.addEventListener('click', () => {
        triggerSimPaste(i);
      });

      hudList.append(li);
    });
  }

  // Add new item into the simulated 9-slot buffer
  function pushSimSlot(text) {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();

    simState.slots[simState.next] = cleanText;
    const filledIdx = simState.next;
    simState.next = (simState.next + 1) % SLOT_COUNT;
    
    renderHud();

    // Flash the updated slot
    const row = hudList.children[filledIdx];
    if (row) {
      row.classList.add('pasted-flash');
      setTimeout(() => row.classList.remove('pasted-flash'), 400);
    }

    showToast(`Copied into Slot ${filledIdx + 1}!`);
  }

  // Paste a specific slot into the simulated editor
  let simLineCounter = 1;
  function triggerSimPaste(slotIdx) {
    const text = simState.slots[slotIdx];
    if (!text) {
      showToast(`Slot ${slotIdx + 1} is empty!`, 'warning');
      return;
    }

    // Visual flash on HUD
    const row = hudList.children[slotIdx];
    if (row) {
      row.classList.add('pasted-flash');
      setTimeout(() => row.classList.remove('pasted-flash'), 350);
    }

    // Visual press on numpad
    const key = document.querySelector(`.key-cap[data-key="${slotIdx + 1}"]`);
    if (key) {
      key.classList.add('pressed');
      setTimeout(() => key.classList.remove('pressed'), 250);
    }

    // Append to simulated editor
    if (simEditorBody) {
      const line = document.createElement('div');
      line.className = 'sim-editor-line';

      const lineNo = document.createElement('span');
      lineNo.className = 'line-no';
      lineNo.textContent = simLineCounter++;

      const lineContent = document.createElement('span');
      lineContent.className = 'line-text';
      lineContent.textContent = text;

      line.append(lineNo, lineContent);
      simEditorBody.appendChild(line);
      simEditorBody.scrollTop = simEditorBody.scrollHeight;
    }

    showToast(`Pasted Slot ${slotIdx + 1} with Ctrl+${slotIdx + 1}!`);
  }

  // Clear slots
  if (simClearBtn) {
    simClearBtn.addEventListener('click', () => {
      simState.slots = Array(SLOT_COUNT).fill(null);
      simState.next = 0;
      renderHud();
      if (simEditorBody) simEditorBody.innerHTML = '';
      simLineCounter = 1;
      showToast('All 9 slots wiped (Ctrl+Alt+.)');
    });
  }

  // Toggle on/off
  if (simToggleState) {
    simToggleState.addEventListener('click', () => {
      simState.enabled = !simState.enabled;
      renderHud();
      showToast(simState.enabled ? 'C-Slot Resumed (Active)' : 'C-Slot Paused (Ctrl+Alt+0)');
    });
  }

  // Quick sample chips
  sampleChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const val = chip.getAttribute('data-value') || chip.textContent.trim();
      pushSimSlot(val);
    });
  });

  // Custom text submit
  if (simAddForm) {
    simAddForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!simCustomInput) return;
      const val = simCustomInput.value;
      if (val.trim()) {
        pushSimSlot(val);
        simCustomInput.value = '';
      }
    });
  }

  // Numpad button click handling
  numpadKeys.forEach(k => {
    k.addEventListener('click', () => {
      const num = parseInt(k.getAttribute('data-key'), 10);
      if (num >= 1 && num <= 9) {
        triggerSimPaste(num - 1);
      }
    });
  });

  // Keyboard shortcut listener (Press 1..9 on page to test paste if not typing in input)
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    const keyNum = parseInt(e.key, 10);
    if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= 9) {
      triggerSimPaste(keyNum - 1);
    }
  });

  // Initial HUD render
  renderHud();

  // ------------------------------------------------------------------------
  // 3. DOWNLOAD LOGIC & FALLBACK ROUTING
  // ------------------------------------------------------------------------
  const isLocalServer = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isFileProtocol = window.location.protocol === 'file:';

  const GITHUB_SETUP_URL = 'https://github.com/Md-Ruwaid/C-slot/releases/download/v0.1.0/Ctrl-Slot-Setup-0.1.0.exe';
  const GITHUB_PORTABLE_URL = 'https://github.com/Md-Ruwaid/C-slot/releases/download/v0.1.0/Ctrl-Slot-Portable.exe';

  function handleDownloadClick(e, type) {
    if (isLocalServer) {
      // Local streaming from server.js
      e.preventDefault();
      const localUrl = type === 'setup' ? '/download/setup' : '/download/portable';
      const a = document.createElement('a');
      a.href = localUrl;
      a.download = type === 'setup' ? 'Ctrl-Slot-Setup-0.1.0.exe' : 'Ctrl-Slot-Portable.exe';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else if (isFileProtocol) {
      e.preventDefault();
      const relUrl = type === 'setup' ? '../dist/Ctrl Slot Setup 0.1.0.exe' : '../dist/Ctrl Slot-Portable.exe';
      const a = document.createElement('a');
      a.href = relUrl;
      a.download = type === 'setup' ? 'Ctrl-Slot-Setup-0.1.0.exe' : 'Ctrl-Slot-Portable.exe';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    // On Vercel / Web, allow native browser navigation to trigger file download directly from GitHub Releases

    openDownloadModal(type);
  }

  downloadSetupBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      handleDownloadClick(e, 'setup');
    });
  });

  downloadPortableBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      handleDownloadClick(e, 'portable');
    });
  });

  // ------------------------------------------------------------------------
  // 4. DOWNLOAD MODAL & TOASTS
  // ------------------------------------------------------------------------
  function openDownloadModal(type) {
    if (!dlModal) return;
    const modalType = document.getElementById('modalDlType');
    const modalRetry = document.getElementById('modalRetryLink');
    if (modalType) {
      modalType.textContent = type === 'setup' 
        ? 'C-Slot Setup 0.1.0 (Installer)' 
        : 'C-Slot Portable 0.1.0';
    }
    if (modalRetry) {
      modalRetry.href = type === 'setup' ? GITHUB_SETUP_URL : GITHUB_PORTABLE_URL;
      modalRetry.download = type === 'setup' ? 'Ctrl-Slot-Setup-0.1.0.exe' : 'Ctrl-Slot-Portable.exe';
    }
    dlModal.classList.add('active');
  }

  function closeDownloadModal() {
    if (dlModal) dlModal.classList.remove('active');
  }

  if (dlModalClose) {
    dlModalClose.addEventListener('click', closeDownloadModal);
  }

  if (dlModal) {
    dlModal.addEventListener('click', (e) => {
      if (e.target === dlModal) closeDownloadModal();
    });
  }

  // Toast notification system
  let toastTimer = null;
  function showToast(message, type = 'success') {
    if (!toast || !toastMsg) return;
    toastMsg.textContent = message;
    toast.classList.add('show');
    
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  // Copy SHA-256 hash button
  copyHashBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const hash = btn.getAttribute('data-hash');
      if (hash && navigator.clipboard) {
        navigator.clipboard.writeText(hash).then(() => {
          showToast('SHA-256 Hash copied to clipboard!');
        }).catch(() => {
          showToast('Failed to copy hash');
        });
      }
    });
  });

  // ------------------------------------------------------------------------
  // 5. FAQ ACCORDION INTERACTION
  // ------------------------------------------------------------------------
  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    if (questionBtn) {
      questionBtn.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        // Close others
        faqItems.forEach(other => other.classList.remove('active'));
        if (!isActive) {
          item.classList.add('active');
        }
      });
    }
  });

  // ------------------------------------------------------------------------
  // 6. NAVBAR SCROLL EFFECT
  // ------------------------------------------------------------------------
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      navbar.style.background = 'rgba(9, 10, 15, 0.94)';
      navbar.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.6)';
    } else {
      navbar.style.background = 'rgba(9, 10, 15, 0.78)';
      navbar.style.boxShadow = 'none';
    }
  });
});
