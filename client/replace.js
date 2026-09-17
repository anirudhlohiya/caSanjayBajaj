const fs = require('fs');
const oldHtml = fs.readFileSync('src/app/features/documents/documents.html', 'utf8');

const newHtml = `@if (false) {
` + oldHtml + `
}

<div class="flex flex-col gap-5 pb-10">
  <div>
    <h1 class="text-xl font-bold tracking-tight text-neutral-950 dark:text-white">Documents</h1>
    <p class="text-sm text-neutral-500 mt-1 dark:text-neutral-400">
      Manage your GST documents and returns
    </p>
  </div>

  <div class="card p-4 flex flex-col gap-2">
    <label class="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Select Period</label>
    <div class="flex items-center justify-between border border-neutral-200 rounded-lg p-3 cursor-pointer">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-neutral-500 text-[20px]">calendar_month</span>
        <span class="font-semibold text-neutral-900 text-sm">September 2026</span>
      </div>
      <span class="material-symbols-outlined text-neutral-400 text-[20px]">expand_more</span>
    </div>
  </div>

  <div class="card p-4">
    <div class="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">CURRENT GST PERIOD</div>
    <div class="text-xl font-bold text-neutral-900 mb-0.5">September 2026</div>
    <div class="text-[13px] text-neutral-600 mb-5">Monthly GST</div>
    
    <div class="flex justify-between items-end mb-2">
      <div class="text-[11px] font-semibold text-neutral-800">Documents Progress</div>
      <div class="text-[11px] font-semibold text-neutral-800">2 / 3</div>
    </div>
    <div class="h-2 w-full bg-neutral-100 rounded-full overflow-hidden mb-2">
      <div class="h-full bg-neutral-900 rounded-full" style="width: 66%;"></div>
    </div>
    <div class="text-[11px] font-semibold text-amber-600">1 document remaining</div>
  </div>

  <div>
    <div class="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-3 ml-1">DOCUMENTS TO SUBMIT</div>
    <div class="card overflow-hidden divide-y divide-neutral-100">
      <div class="p-4 flex items-center justify-between bg-white cursor-pointer hover:bg-neutral-50 transition-colors">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-green-50 flex flex-col items-center justify-center text-green-700">
            <span class="material-symbols-outlined text-[18px]">description</span>
            <span class="text-[9px] font-bold mt-0.5">XLS</span>
          </div>
          <div>
            <div class="font-semibold text-neutral-900 text-sm">GSTR-1</div>
            <div class="text-[11px] text-neutral-500 mt-0.5">Excel File</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="text-right">
            <div class="flex items-center justify-end gap-1 text-green-600">
              <span class="material-symbols-outlined text-[16px]">check</span>
              <span class="text-[11px] font-semibold">Uploaded</span>
            </div>
            <div class="text-[10px] text-neutral-400 mt-0.5">Sep 2026</div>
          </div>
          <span class="material-symbols-outlined text-neutral-300" style="font-size: 20px">chevron_right</span>
        </div>
      </div>

      <div class="p-4 flex items-center justify-between bg-white cursor-pointer hover:bg-neutral-50 transition-colors">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-red-50 flex flex-col items-center justify-center text-red-700">
            <span class="text-[9px] font-bold">PDF</span>
            <span class="text-[9px] font-bold -mt-0.5">JPG</span>
          </div>
          <div>
            <div class="font-semibold text-neutral-900 text-sm">Sales Bills</div>
            <div class="text-[11px] text-neutral-500 mt-0.5">PDF / JPG</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="text-right">
            <div class="flex items-center justify-end gap-1.5 text-green-600 mb-0.5">
              <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              <span class="text-[11px] font-semibold">18 files uploaded</span>
            </div>
            <div class="text-[10px] text-neutral-400">Sep 2026</div>
          </div>
          <span class="material-symbols-outlined text-neutral-300" style="font-size: 20px">chevron_right</span>
        </div>
      </div>

      <div class="p-4 flex items-center justify-between bg-white cursor-pointer hover:bg-neutral-50 transition-colors">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-red-50 flex flex-col items-center justify-center text-red-700">
            <span class="text-[9px] font-bold">PDF</span>
            <span class="text-[9px] font-bold -mt-0.5">IMG</span>
          </div>
          <div>
            <div class="font-semibold text-neutral-900 text-sm">Purchase Bills</div>
            <div class="text-[11px] text-neutral-500 mt-0.5">PDF / Photo</div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-right flex flex-col items-end">
            <div class="flex items-center gap-1.5 text-neutral-600 mb-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span class="text-[11px] font-semibold">Required</span>
            </div>
            <button (click)="uploadFiles(); $event.stopPropagation()" class="flex items-center gap-1 px-3 py-1 rounded-md border border-neutral-200 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer">
              <span class="material-symbols-outlined text-[16px]">add</span>
              Upload Files
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div>
    <div class="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-3 ml-1">FROM YOUR CA</div>
    <div class="card p-4 flex items-center justify-between bg-white cursor-pointer hover:bg-neutral-50 transition-colors">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-red-50 flex flex-col items-center justify-center text-red-700">
          <span class="text-[10px] font-bold">PDF</span>
        </div>
        <div>
          <div class="font-semibold text-neutral-900 text-sm">GSTR-2B</div>
          <div class="text-[11px] text-neutral-500 mt-0.5">September 2026</div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-[11px] font-semibold text-green-600">Available</span>
        <button class="w-8 h-8 flex items-center justify-center text-neutral-900 cursor-pointer hover:bg-neutral-100 rounded-full">
          <span class="material-symbols-outlined text-[20px]">download</span>
        </button>
      </div>
    </div>
  </div>

  <div>
    <div class="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-3 ml-1">FILED RETURNS</div>
    <div class="card p-4 flex flex-col gap-3 bg-white">
      <div>
        <label class="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">Select Financial Year</label>
        <div class="flex items-center justify-between border border-neutral-200 rounded-lg p-3 cursor-pointer">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-neutral-400 text-[20px]">calendar_month</span>
            <span class="font-semibold text-neutral-900 text-sm">FY 2026-27</span>
          </div>
          <span class="material-symbols-outlined text-neutral-400 text-[20px]">expand_more</span>
        </div>
      </div>
      
      <div>
        <label class="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">Select Month</label>
        <div class="flex items-center justify-between border border-neutral-200 rounded-lg p-3 cursor-pointer">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-neutral-400 text-[20px]">calendar_month</span>
            <span class="font-semibold text-neutral-900 text-sm">September 2026</span>
          </div>
          <span class="material-symbols-outlined text-neutral-400 text-[20px]">expand_more</span>
        </div>
      </div>

      <button (click)="requestReport()" class="w-full py-2.5 mt-2 rounded-xl border border-neutral-300 text-sm font-bold text-neutral-900 hover:bg-neutral-50 transition-colors flex items-center justify-center cursor-pointer">
        Request Report
      </button>
    </div>
  </div>
</div>`;

fs.writeFileSync('src/app/features/documents/documents.html', newHtml);
