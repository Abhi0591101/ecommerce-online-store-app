// Premium Pop-up Toast & Modal Notification System
// Replaces standard browser alerts with modern, animated glassmorphism cards

class NotificationEngine {
  constructor() {
    this.initContainers();
  }

  initContainers() {
    // 1. Toast Container (Top-Right Floating)
    if (!document.getElementById('toastContainer')) {
      const toastDiv = document.createElement('div');
      toastDiv.id = 'toastContainer';
      toastDiv.className = 'fixed top-5 right-5 z-[100050] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0';
      document.body.appendChild(toastDiv);
    }

    // 2. Custom Pop-up Modal Container
    if (!document.getElementById('customConfirmModal')) {
      const modalDiv = document.createElement('div');
      modalDiv.id = 'customConfirmModal';
      modalDiv.className = 'fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100020] hidden items-center justify-center p-4 transition-all duration-200';
      modalDiv.innerHTML = `
        <div class="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 p-6 text-center animate-in fade-in zoom-in-95 duration-150">
          <div id="confirmModalIcon" class="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl mx-auto mb-3 shadow-inner">
            ❓
          </div>
          <h3 id="confirmModalTitle" class="font-black text-slate-900 text-base mb-1.5">Are you sure?</h3>
          <p id="confirmModalMessage" class="text-xs text-slate-500 mb-6 leading-relaxed">This action cannot be undone.</p>
          
          <div class="flex items-center justify-center gap-3">
            <button type="button" id="btnConfirmCancel" class="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition">
              Cancel
            </button>
            <button type="button" id="btnConfirmProceed" class="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition">
              Confirm
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modalDiv);
    }
  }

  // --- Pop-up Toasts ---
  showToast({ type = 'success', title = '', message = '', duration = 3500 }) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toastId = 'toast_' + Math.random().toString(36).substr(2, 9);
    
    let icon = '🎉';
    let borderClass = 'border-emerald-200 bg-white text-slate-800';
    let iconBg = 'bg-emerald-100 text-emerald-700';

    if (type === 'error') {
      icon = '⚠️';
      borderClass = 'border-rose-200 bg-white text-slate-800';
      iconBg = 'bg-rose-100 text-rose-700';
    } else if (type === 'info') {
      icon = '⚡';
      borderClass = 'border-indigo-200 bg-white text-slate-800';
      iconBg = 'bg-indigo-100 text-indigo-700';
    }

    const toastHtml = `
      <div id="${toastId}" class="pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl shadow-xl border ${borderClass} animate-in slide-in-from-top-4 fade-in duration-200 transition-all">
        <div class="w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center text-sm flex-shrink-0 font-bold">
          ${icon}
        </div>
        <div class="flex-1 pr-2">
          ${title ? `<h4 class="font-black text-slate-900 text-xs">${title}</h4>` : ''}
          <p class="text-[11px] text-slate-600 ${title ? 'mt-0.5' : 'font-bold'} leading-snug">${message}</p>
        </div>
        <button onclick="document.getElementById('${toastId}')?.remove()" class="text-slate-400 hover:text-slate-700 font-bold text-xs p-1">
          ✕
        </button>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', toastHtml);

    setTimeout(() => {
      const el = document.getElementById(toastId);
      if (el) {
        el.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => el.remove(), 200);
      }
    }, duration);
  }

  success(message, title = 'Success!') {
    this.showToast({ type: 'success', title, message });
  }

  error(message, title = 'Attention') {
    this.showToast({ type: 'error', title, message, duration: 4500 });
  }

  info(message, title = 'Notice') {
    this.showToast({ type: 'info', title, message });
  }

  // --- Beautiful Pop-up Confirm Modal ---
  confirm({ title = 'Confirm Action', message = 'Are you sure?', confirmText = 'Confirm', cancelText = 'Cancel', isDanger = false, onConfirm = () => {} }) {
    const modal = document.getElementById('customConfirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const msgEl = document.getElementById('confirmModalMessage');
    const iconEl = document.getElementById('confirmModalIcon');
    const btnProceed = document.getElementById('btnConfirmProceed');
    const btnCancel = document.getElementById('btnConfirmCancel');

    if (!modal) return;

    titleEl.innerText = title;
    msgEl.innerText = message;
    btnProceed.innerText = confirmText;
    btnCancel.innerText = cancelText;

    if (isDanger) {
      iconEl.innerHTML = '🗑️';
      iconEl.className = 'w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-2xl mx-auto mb-3 shadow-inner';
      btnProceed.className = 'w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/30 transition';
    } else {
      iconEl.innerHTML = '✨';
      iconEl.className = 'w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl mx-auto mb-3 shadow-inner';
      btnProceed.className = 'w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition';
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const handleConfirm = () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      btnProceed.removeEventListener('click', handleConfirm);
      onConfirm();
    };

    const handleCancel = () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      btnCancel.removeEventListener('click', handleCancel);
    };

    btnProceed.onclick = handleConfirm;
    btnCancel.onclick = handleCancel;
  }
}

window.notify = new NotificationEngine();
