import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AbstractControl, FormBuilder, ReactiveFormsModule, FormGroup, FormControl, Validators, FormArray } from '@angular/forms';
import { RentAgreementsService } from '../../core/services/feature.services';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { DomSanitizer } from '@angular/platform-browser';
import { PageHeader } from '../../shared/components/page-header';
import { Spinner } from '../../shared/components/spinner';
import { OfficeEditor } from './office-editor';

export interface TemplateField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'currency' | 'multiline' | 'array';
  required: boolean;
  section: string;
  options?: { label: string; value: string }[];
  arrayFields?: Omit<TemplateField, 'section' | 'arrayFields'>[];
}

export interface TemplateConfig {
  id: string;
  name: string;
  language: string;
  category: string;
  description: string;
  templateFileName: string;
  fields: TemplateField[];
}

@Component({
  selector: 'app-rent-agreements-create',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, PageHeader, Spinner, OfficeEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rent-agreements-create.html',
  styles: [`
    .edit-toolbar-btn {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 32px; height: 32px; padding: 0 8px;
      border: 1px solid var(--color-outline-variant); border-radius: 6px;
      background: var(--color-surface-bright); color: var(--color-on-surface);
      font-size: 13px; cursor: pointer; transition: background 0.15s ease;
      font-family: inherit;
    }
    .edit-toolbar-btn:hover { background: var(--color-surface-container-high); }
    .edit-toolbar-btn b { font-weight: 700; } .edit-toolbar-btn i { font-style: italic; } .edit-toolbar-btn u { text-decoration: underline; }
    .editor-scroll { background: var(--color-surface-container-high); }
    .editable-docx {
      width: 100%; max-width: 800px; min-height: 1000px;
      background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.12);
      padding: 80px 90px; border: 1px solid #ddd; border-radius: 2px;
      font-family: 'Times New Roman', Times, serif; color: #000;
      font-size: 12pt; line-height: 1.6; outline: none;
      text-align: justify;
    }
    .editable-docx p, .editable-docx div, .editable-docx h1, .editable-docx h2, .editable-docx h3,
    .editable-docx h4, .editable-docx li { font-family: 'Times New Roman', Times, serif; }
    .editable-docx h1 { font-size: 20pt; text-align: center; margin: 12px 0; }
    .editable-docx h2 { font-size: 16pt; text-align: center; margin: 10px 0; }
    .editable-docx h3 { font-size: 14pt; margin: 8px 0; }
    .editable-docx table { border-collapse: collapse; width: 100%; margin: 10px 0; }
    .editable-docx td, .editable-docx th { border: 1px solid #000; padding: 4px 8px; }
    .editable-docx strong { font-weight: bold; }
    .editable-docx em { font-style: italic; }
    .ra-tab-active {
      background: var(--color-secondary-container);
      color: var(--color-on-secondary-container);
    }
    .ra-modal-panes { display: flex; flex-direction: column; }
    .ra-edit-pane, .ra-pdf-pane { min-width: 0; min-height: 0; }
    @media (min-width: 1024px) {
      .ra-modal-panes {
        display: grid !important;
        grid-template-columns: 1fr 1fr;
      }
      .ra-edit-pane, .ra-pdf-pane { display: flex !important; }
    }
  `],
})
export class RentAgreementsCreate implements OnInit {
  private readonly rentAgreementsService = inject(RentAgreementsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly templates = signal<TemplateConfig[]>([]);
  readonly selectedTemplate = signal<TemplateConfig | null>(null);
  readonly agreementId = signal<string | null>(null);
  readonly previewHtml = signal<string | null>(null);
  readonly showPreviewModal = signal(false);
  readonly converting = signal(false);
  readonly officeOpen = signal(false);
  readonly previewTab = signal<'edit' | 'pdf'>('edit');
  readonly previewPdfUrl = signal<string | null>(null);
  readonly previewPdfSafeUrl = computed(() => {
    const url = this.previewPdfUrl();
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
  readonly pdfLoading = signal(false);
  
  @ViewChild('editableDoc') editableDoc?: ElementRef<HTMLDivElement>;
  
  // Group fields by section for rendering
  readonly sections = computed(() => {
    const tpl = this.selectedTemplate();
    if (!tpl) return [];
    
    const map = new Map<string, TemplateField[]>();
    for (const f of tpl.fields) {
      const arr = map.get(f.section) || [];
      arr.push(f);
      map.set(f.section, arr);
    }
    return Array.from(map.entries()).map(([name, fields]) => ({ name, fields }));
  });

  readonly form = this.fb.group({
    template_id: ['', Validators.required],
  });
  
  readonly dynamicForm = this.fb.group({});

  ngOnInit(): void {
    void this.loadData();
    
    this.form.get('template_id')?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(id => {
      this.onTemplateChange(id || '');
    });

    this.destroyRef.onDestroy(() => {
      if (this.previewPdfUrl()) {
        window.URL.revokeObjectURL(this.previewPdfUrl()!);
      }
    });
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.rentAgreementsService.getTemplates();
      this.templates.set(res.data);
      
      const id = this.route.snapshot.queryParamMap.get('id');
      if (id) {
        this.agreementId.set(id);
        const agreementRes = await this.rentAgreementsService.get(id);
        const agreement = agreementRes.data;
        
        // Setup form for edit
        this.form.patchValue({ template_id: agreement.template_id });
        // The valueChanges subscription will rebuild the dynamicForm, wait a tick to patch data
        setTimeout(() => {
           this.dynamicForm.patchValue(agreement.form_data || {});
        });
      } else if (this.templates().length > 0) {
        // Select first template by default if creating new
        this.form.patchValue({ template_id: this.templates()[0].id });
      }
    } catch (err) {
      this.toast.error('Failed to load data');
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }

  onTemplateChange(templateId: string): void {
    const tpl = this.templates().find(t => t.id === templateId) || null;
    this.selectedTemplate.set(tpl);
    
    // Clear and rebuild dynamic form
    Object.keys(this.dynamicForm.controls).forEach(key => {
      this.dynamicForm.removeControl(key);
    });
    
    if (tpl) {
      tpl.fields.forEach(f => {
        if (f.type === 'array' && f.arrayFields) {
          const arr = this.fb.array([]);
          this.dynamicForm.addControl(f.key, arr);
          // Default to 1 item
          this.addArrayItem(f.key, f.arrayFields);
        } else {
          const validators = f.required ? [Validators.required] : [];
          this.dynamicForm.addControl(f.key, new FormControl('', validators));
        }
      });
    }
  }

  getArrayControls(key: string): FormGroup[] {
    return (this.dynamicForm.get(key) as FormArray).controls as FormGroup[];
  }

  addArrayItem(key: string, arrayFields: any[]): void {
    const arr = this.dynamicForm.get(key) as FormArray;
    const group = this.fb.group({});
    arrayFields.forEach(af => {
      const validators = af.required ? [Validators.required] : [];
      group.addControl(af.key, new FormControl('', validators));
    });
    arr.push(group);
  }

  removeArrayItem(key: string, index: number): void {
    const arr = this.dynamicForm.get(key) as FormArray;
    arr.removeAt(index);
  }

  async save(status: 'draft' | 'generated'): Promise<void> {
    if (this.form.invalid || this.dynamicForm.invalid) {
      this.form.markAllAsTouched();
      this.dynamicForm.markAllAsTouched();
      this.toast.error('Please fill all required fields');
      return;
    }

    this.saving.set(true);
    try {
      const template_id = this.form.value.template_id;
      const form_data = this.dynamicForm.value;
      const payload = { template_id: template_id!, form_data, status };
      
      let savedId = this.agreementId();
      if (savedId) {
        await this.rentAgreementsService.update(savedId, { form_data, status });
        this.toast.success('Agreement updated');
      } else {
        const res = await this.rentAgreementsService.create(payload);
        savedId = res.data.id;
        this.agreementId.set(savedId);
        this.toast.success('Agreement created');
        // Update URL to edit mode
        void this.router.navigate([], { queryParams: { id: savedId }, queryParamsHandling: 'merge', replaceUrl: true });
      }
      
      if (status === 'generated' && savedId) {
        this.downloadDocx(savedId);
      } else if (status === 'draft') {
        void this.router.navigate(['/rent-agreements']);
      }
      
    } catch (err) {
      console.error(err);
      this.toast.error('Failed to save agreement');
    } finally {
      this.saving.set(false);
    }
  }

  async preview(): Promise<void> {
    if (this.form.invalid || this.dynamicForm.invalid) {
      this.form.markAllAsTouched();
      this.dynamicForm.markAllAsTouched();
      this.toast.error('Please fill all required fields');
      return;
    }

    this.saving.set(true);
    try {
      const template_id = this.form.value.template_id;
      const form_data = this.dynamicForm.value;
      const payload = { template_id: template_id!, form_data };
      
      const res = await this.rentAgreementsService.preview(payload);
      this.previewHtml.set(res.data);
      this.previewTab.set('edit');
      this.showPreviewModal.set(true);
      void this.loadPdfPreview(payload);
    } catch (err) {
      console.error(err);
      this.toast.error('Failed to generate preview');
    } finally {
      this.saving.set(false);
    }
  }

  private async loadPdfPreview(payload: { template_id: string; form_data: any; status?: string }): Promise<void> {
    this.pdfLoading.set(true);
    try {
      const blob = await this.rentAgreementsService.previewPdf(payload);
      if (this.previewPdfUrl()) {
        window.URL.revokeObjectURL(this.previewPdfUrl()!);
      }
      this.previewPdfUrl.set(window.URL.createObjectURL(blob));
    } catch (err) {
      console.error(err);
      this.toast.error('PDF preview unavailable (requires LibreOffice on the server)');
      this.previewPdfUrl.set(null);
    } finally {
      this.pdfLoading.set(false);
    }
  }

  refreshPdf(): void {
    if (this.form.invalid || this.dynamicForm.invalid) {
      this.toast.error('Please fill all required fields');
      return;
    }
    const template_id = this.form.value.template_id;
    const form_data = this.dynamicForm.value;
    void this.loadPdfPreview({ template_id: template_id!, form_data });
  }

  closePreview(): void {
    if (this.previewPdfUrl()) {
      window.URL.revokeObjectURL(this.previewPdfUrl()!);
      this.previewPdfUrl.set(null);
    }
    this.showPreviewModal.set(false);
  }

  async openOffice(): Promise<void> {
    if (this.form.invalid || this.dynamicForm.invalid) {
      this.form.markAllAsTouched();
      this.dynamicForm.markAllAsTouched();
      this.toast.error('Please fill all required fields');
      return;
    }

    this.saving.set(true);
    try {
      let savedId = this.agreementId();
      if (!savedId) {
        const template_id = this.form.value.template_id;
        const form_data = this.dynamicForm.value;
        const res = await this.rentAgreementsService.create({
          template_id: template_id!,
          form_data,
          status: 'draft',
        });
        savedId = res.data.id;
        this.agreementId.set(savedId);
        void this.router.navigate([], { queryParams: { id: savedId }, queryParamsHandling: 'merge', replaceUrl: true });
      }
      this.officeOpen.set(true);
    } catch (err) {
      console.error(err);
      this.toast.error('Failed to open the Word editor');
    } finally {
      this.saving.set(false);
    }
  }

  execCommand(cmd: string, value?: string): void {
    this.editableDoc?.nativeElement.focus();
    document.execCommand(cmd, false, value);
  }

  downloadEditedDocx(): void {
    const html = this.editableDoc?.nativeElement.innerHTML;
    if (!html || !this.selectedTemplate()) {
      this.toast.error('Nothing to download');
      return;
    }

    this.converting.set(true);
    this.rentAgreementsService.convertEditedHtml(html)
      .then(blob => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = downloadUrl;
        a.download = `Edited_Agreement_${this.selectedTemplate()?.name.replace(/\s+/g, '_')}.docx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        this.toast.success('Edited document downloaded');
      })
      .catch(err => {
        console.error(err);
        this.toast.error('Failed to convert edited document');
      })
      .finally(() => this.converting.set(false));
  }

  downloadDocx(id: string): void {
    const url = this.rentAgreementsService.getDownloadUrl(id);
    const token = this.auth.access;
    if (token) {
        fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(response => {
            if (!response.ok) throw new Error('Download failed');
            return response.blob();
        })
        .then(blob => {
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            a.download = `Rent_Agreement_${id.substring(0, 8)}.docx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            this.toast.success('Document downloaded');
            void this.router.navigate(['/rent-agreements']);
        })
        .catch(err => {
            console.error(err);
            this.toast.error('Failed to download document');
        });
    }
  }
}
