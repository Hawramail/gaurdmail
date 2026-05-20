<template>
  <q-page class="send-email-page">
    <!-- ── THREE-COLUMN GRID ── -->
    <div class="composer-grid q-pa-md">
      <!-- ══ COLUMN 1: EMAIL SETUP ══ -->
      <q-card flat bordered class="composer-card">
        <q-card-section class="card-header-section">
          <div class="step-badge">1</div>
          <div class="card-header-left">
            <div class="card-title">Email Setup</div>
            <div class="card-subtitle">Company, template &amp; recipients</div>
          </div>
          <div class="card-icon-wrap icon-blue">
            <q-icon name="tune" size="18px" />
          </div>
        </q-card-section>

        <q-separator class="soft-sep" />

        <q-card-section class="card-scroll-body q-gutter-sm">
          <!-- ─ Email ─ -->
          <div class="inner-section-label">
            <q-icon name="mail_outline" size="12px" />
            Email
          </div>

          <div class="field-wrap">
            <div class="field-label">Insurance Company</div>
            <q-select
              v-model="form.company"
              :options="companyOptions"
              outlined
              dense
              emit-value
              map-options
              options-dense
              clearable
              placeholder="Select company"
              class="styled-select"
            >
              <template #prepend>
                <q-icon name="business" color="primary" size="16px" />
              </template>
            </q-select>
          </div>

          <div class="field-wrap">
            <div class="field-label">Email Template</div>
            <q-select
              v-model="form.template"
              :options="templateOptions"
              outlined
              dense
              emit-value
              map-options
              options-dense
              clearable
              placeholder="Select template"
              class="styled-select"
            >
              <template #prepend>
                <q-icon name="description" color="primary" size="16px" />
              </template>
            </q-select>
          </div>

          <div class="field-wrap">
            <div class="field-label">Subject Line</div>
            <q-input
              v-model="form.subject"
              outlined
              dense
              placeholder="Email subject line"
              class="styled-input"
            >
              <template #prepend>
                <q-icon name="title" color="primary" size="16px" />
              </template>
            </q-input>
          </div>

          <!-- ─ Recipients ─ -->
          <div class="inner-section-label">
            <q-icon name="people_outline" size="12px" />
            Recipients
          </div>

          <div class="field-wrap">
            <div class="field-label">To — Primary Recipients</div>
            <q-select
              v-model="form.to"
              :options="toOptions"
              outlined
              dense
              multiple
              use-chips
              use-input
              new-value-mode="add-unique"
              hide-dropdown-icon
              placeholder="Add recipient email"
              class="styled-select chips-select"
            >
              <template #prepend>
                <q-icon name="mail" color="primary" size="16px" />
              </template>
              <template #selected-item="scope">
                <q-chip
                  removable
                  dense
                  @remove="scope.removeAtIndex(scope.index)"
                  :tabindex="scope.tabindex"
                  color="blue-1"
                  text-color="blue-9"
                  class="email-chip"
                >
                  {{ scope.opt }}
                </q-chip>
              </template>
            </q-select>
          </div>

          <div class="field-wrap">
            <div class="field-label">CC — Carbon Copy</div>
            <q-select
              v-model="form.cc"
              :options="ccOptions"
              outlined
              dense
              multiple
              use-chips
              use-input
              new-value-mode="add-unique"
              hide-dropdown-icon
              placeholder="Add CC email"
              class="styled-select chips-select"
            >
              <template #prepend>
                <q-icon name="group" color="primary" size="16px" />
              </template>
              <template #selected-item="scope">
                <q-chip
                  removable
                  dense
                  @remove="scope.removeAtIndex(scope.index)"
                  :tabindex="scope.tabindex"
                  color="teal-1"
                  text-color="teal-9"
                  class="email-chip"
                >
                  {{ scope.opt }}
                </q-chip>
              </template>
            </q-select>
          </div>

          <!-- ─ Attachments ─ -->
          <div class="inner-section-label">
            <q-icon name="attach_file" size="12px" />
            Attachments
          </div>

          <div class="field-wrap">
            <div class="field-label">Files</div>
            <q-file
              v-model="form.attachments"
              outlined
              dense
              multiple
              use-chips
              clearable
              placeholder="Drop files or click to attach"
              class="styled-input"
              @update:model-value="onAttachmentsChange"
            >
              <template #prepend>
                <q-icon name="cloud_upload" color="primary" size="16px" />
              </template>
              <template #hint>
                <span class="file-hint">
                  {{ form.attachments ? form.attachments.length : 0 }} file(s) ·
                  {{ totalFileSize }}
                </span>
              </template>
            </q-file>
          </div>

          <!-- ─ Attachment Previews ─ -->
          <div v-if="attachmentList.length" class="attach-preview-strip">
            <div
              v-for="(file, i) in attachmentList"
              :key="i"
              class="attach-preview-card"
              @click.stop="openLightbox(i)"
            >
              <q-btn
                flat round dense
                icon="close"
                size="xs"
                color="grey-5"
                class="attach-remove-btn"
                @click.stop="removeAttachment(i)"
              />
              <img
                v-if="isImageFile(file)"
                :src="previewUrls[i]"
                class="attach-preview-thumb"
                :title="file.name"
              />
              <div v-else class="attach-preview-icon-wrap">
                <q-icon :name="fileTypeIcon(file)" size="24px" color="primary" />
              </div>
              <div class="attach-preview-name" :title="file.name">{{ file.name }}</div>
              <div class="attach-preview-size">{{ formatFileSize(file.size) }}</div>
            </div>
          </div>

          <div class="field-wrap">
            <div class="field-label">Send attachments as</div>
            <div class="attach-mode-row">
              <div
                class="mode-option"
                :class="{ 'mode-active': form.attachmentMode === 'merge' }"
                @click="form.attachmentMode = 'merge'"
              >
                <q-icon name="merge_type" size="15px" />
                One merged PDF
              </div>
              <div
                class="mode-option"
                :class="{ 'mode-active': form.attachmentMode === 'separate' }"
                @click="form.attachmentMode = 'separate'"
              >
                <q-icon name="call_split" size="15px" />
                Separate files
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- ══ COLUMN 2: COMPOSE ══ -->
      <q-card flat bordered class="composer-card editor-card">
        <q-card-section class="card-header-section">
          <div class="step-badge">2</div>
          <div class="card-header-left">
            <div class="card-title">Compose Email</div>
            <div class="card-subtitle card-subtitle--template">
              <q-icon
                :name="form.template ? 'check_circle' : 'info_outline'"
                :color="form.template ? 'positive' : 'grey-4'"
                size="11px"
              />
              {{
                form.template
                  ? templateOptions.find((t) => t.value === form.template)
                      ?.label || form.template
                  : "Select a template in Step 1 to begin"
              }}
            </div>
          </div>
          <div class="card-icon-wrap icon-blue">
            <q-icon name="edit_note" size="18px" />
          </div>
        </q-card-section>

        <q-separator class="soft-sep" />

        <q-card-section class="editor-body q-pa-md">
          <q-editor
            v-model="form.content"
            :toolbar="editorToolbar"
            class="tg-editor"
            placeholder="Email body will appear here once a template is selected..."
          />
        </q-card-section>

        <q-separator class="soft-sep" inset />

        <q-card-section class="action-bar q-pt-sm">
          <q-btn
            unelevated
            color="primary"
            label="Authorize Zoho"
            icon="lock_open"
            no-caps
            class="action-btn auth-btn"
            @click="handleAuthEmail"
          />
          <q-btn
            unelevated
            color="positive"
            label="Send Email"
            icon="send"
            no-caps
            class="action-btn send-btn"
            :loading="sending"
            :disable="!isReadyToSend"
            @click="handleSendEmail"
          />
          <q-space />
          <q-btn
            flat
            color="negative"
            label="Reset All"
            icon="restart_alt"
            no-caps
            class="action-btn"
            @click="resetForm"
          />
        </q-card-section>
      </q-card>

      <!-- ══ COLUMN 3: POLICY DETAILS ══ -->
      <div class="right-col">
        <q-card flat bordered class="composer-card">
          <q-card-section class="card-header-section">
            <div class="step-badge step-badge--purple">3</div>
            <div class="card-header-left">
              <div class="card-title">Policy Details</div>
              <div class="card-subtitle">
                Customer &amp; vehicle information
              </div>
            </div>
            <div class="card-icon-wrap icon-purple">
              <q-icon name="policy" size="18px" />
            </div>
          </q-card-section>

          <q-separator class="soft-sep" />

          <q-card-section class="card-scroll-body q-gutter-sm">
            <!-- ─ Customer ─ -->
            <div class="inner-section-label">
              <q-icon name="person_outline" size="12px" />
              Customer
            </div>

            <q-input
              v-model="formInputs.customerName"
              outlined
              dense
              label="Full Name"
              class="styled-input"
            >
              <template #prepend>
                <q-icon name="badge" color="primary" size="15px" />
              </template>
            </q-input>

            <q-input
              v-model="formInputs.customerCPR"
              outlined
              dense
              label="CPR / CR Number"
              class="styled-input"
            >
              <template #prepend>
                <q-icon name="fingerprint" color="primary" size="15px" />
              </template>
            </q-input>

            <q-checkbox
              v-model="formInputs.underCompanyName"
              label="Policy is under a company name"
              color="primary"
              dense
              class="company-check"
            />

            <!-- ─ Vehicle ─ -->
            <div class="inner-section-label">
              <q-icon name="directions_car" size="12px" />
              Vehicle
            </div>

            <div class="input-row">
              <q-input
                v-model="formInputs.plateNo"
                outlined
                dense
                label="Plate No."
                class="styled-input"
              />
              <q-input
                v-model="formInputs.chassisNo"
                outlined
                dense
                label="Chassis No."
                class="styled-input"
              />
            </div>

            <!-- ─ Policy Period ─ -->
            <div class="inner-section-label">
              <q-icon name="event_note" size="12px" />
              Policy Period
            </div>

            <div class="input-row">
              <q-input
                v-model="formInputs.startDate"
                outlined
                dense
                label="Start Date"
                type="date"
                class="styled-input"
              />
              <q-input
                v-model="formInputs.expiryDate"
                outlined
                dense
                label="Expiry Date"
                type="date"
                class="styled-input"
              />
            </div>

            <q-select
              v-model="formInputs.governmentType"
              :options="governmentTypeOptions"
              outlined
              dense
              emit-value
              map-options
              options-dense
              label="Registration Type"
              clearable
              class="styled-select"
            >
              <template #prepend>
                <q-icon name="flag" color="primary" size="16px" />
              </template>
            </q-select>

            <!-- ─ Endorsement / Cancellation fields ─ -->
            <template v-if="form.template === 'endorsementCancellation'">
              <div class="inner-section-label">
                <q-icon name="edit_note" size="12px" />
                Endorsement / Cancellation
              </div>

              <div class="attach-mode-row">
                <div
                  class="mode-option"
                  :class="{ 'mode-active': formInputs.endorsementType === 'endorsement' }"
                  @click="formInputs.endorsementType = 'endorsement'"
                >
                  <q-icon name="edit" size="14px" />
                  Endorsement
                </div>
                <div
                  class="mode-option"
                  :class="{ 'mode-active': formInputs.endorsementType === 'cancellation' }"
                  @click="formInputs.endorsementType = 'cancellation'"
                >
                  <q-icon name="cancel" size="14px" />
                  Cancellation
                </div>
              </div>

              <q-input
                v-model="formInputs.effectiveDate"
                outlined
                dense
                label="Effective Date"
                type="date"
                class="styled-input"
              >
                <template #prepend>
                  <q-icon name="event" color="primary" size="15px" />
                </template>
              </q-input>

              <q-input
                v-model="formInputs.reason"
                outlined
                dense
                label="Reason / Endorsement Details"
                type="textarea"
                autogrow
                class="styled-input"
              >
                <template #prepend>
                  <q-icon name="notes" color="primary" size="15px" />
                </template>
              </q-input>
            </template>

            <!-- ─ Actions ─ -->
            <div class="inner-section-label">
              <q-icon name="bolt" size="12px" />
              Actions
            </div>

            <q-btn
              unelevated
              color="teal-7"
              icon="document_scanner"
              label="Scan Documents via OCR"
              no-caps
              class="full-width-btn"
              @click="ocrDialogOpen = true"
            />

            <q-btn
              unelevated
              color="deep-orange-7"
              label="Bahrain Traffic Lookup"
              icon="travel_explore"
              no-caps
              class="full-width-btn"
              @click="openTraffic"
            />
          </q-card-section>
        </q-card>
      </div>
    </div>

    <ocr-upload-dialog
      v-model="ocrDialogOpen"
      @fields-confirmed="onFieldsConfirmed"
    />

    <!-- ── LIGHTBOX ── -->
    <q-dialog v-model="lightboxOpen" maximized>
      <div class="lightbox-overlay" @click.self="lightboxOpen = false">

        <div class="lightbox-topbar">
          <div class="lightbox-filename">{{ attachmentList[lightboxIndex]?.name }}</div>
          <div class="lightbox-counter">{{ lightboxIndex + 1 }} / {{ attachmentList.length }}</div>
          <q-btn flat round dense icon="close" color="white" size="sm" @click="lightboxOpen = false" />
        </div>

        <div class="lightbox-body">
          <q-btn
            flat round
            icon="chevron_left"
            color="white"
            size="lg"
            class="lightbox-nav-btn"
            :disable="lightboxIndex === 0"
            @click="lightboxIndex--"
          />

          <div class="lightbox-content">
            <img
              v-if="attachmentList[lightboxIndex] && isImageFile(attachmentList[lightboxIndex])"
              :src="previewUrls[lightboxIndex]"
              class="lightbox-img"
            />
            <iframe
              v-else-if="attachmentList[lightboxIndex]?.type === 'application/pdf'"
              :src="previewUrls[lightboxIndex]"
              class="lightbox-pdf"
            />
            <div v-else-if="attachmentList[lightboxIndex]" class="lightbox-fallback">
              <q-icon :name="fileTypeIcon(attachmentList[lightboxIndex])" size="72px" color="blue-3" />
              <div class="lightbox-fallback-name">{{ attachmentList[lightboxIndex].name }}</div>
              <div class="lightbox-fallback-size">{{ formatFileSize(attachmentList[lightboxIndex].size) }}</div>
            </div>
          </div>

          <q-btn
            flat round
            icon="chevron_right"
            color="white"
            size="lg"
            class="lightbox-nav-btn"
            :disable="lightboxIndex === attachmentList.length - 1"
            @click="lightboxIndex++"
          />
        </div>

      </div>
    </q-dialog>
  </q-page>
</template>

<script>
import { emailTemplates, endorsementCancellation } from "src/data/emailTemplates";
import { useCompanies } from "src/composables/useCompanies";
import { useZoho } from "src/composables/useZoho";
import { useSentEmails } from "src/composables/useSentEmails";
import OcrUploadDialog from "src/components/OcrUploadDialog.vue";
import { useBahrainLookup } from "src/composables/useBahrainLookup";
import { validateFile } from "src/composables/useFileValidation";
import { logSiemEvent } from "src/composables/useSeim";

export default {
  name: "SendEmailPage",
  components: { OcrUploadDialog },

  setup() {
    const { companies } = useCompanies();
    const {
      authZoho,
      sendEmail,
      isTokenValid,
      getTokenAgeMinutes,
      clearSession,
    } = useZoho();
    const { saveSentEmail } = useSentEmails();

    const { runLookup, lookupLoading, lookupError } = useBahrainLookup();

    return {
      companies,
      authZoho,
      sendEmail,
      isTokenValid,
      getTokenAgeMinutes,
      clearSession,
      saveSentEmail,
      runLookup,
      lookupLoading,
      lookupError,
    };
  },

  data() {
    return {
      sending: false,
      zohoConnected: false,
      ocrDialogOpen: false,
      previewUrls: [],
      lightboxOpen: false,
      lightboxIndex: 0,

      templateOptions: [
        { label: "Special Approval", value: "specialApproval" },
        { label: "Issue New Policy", value: "issueNewPolicy" },
        { label: "Change Issued Cover", value: "changeIssuedCover" },
        { label: "Policy Transfer", value: "policyTransfer" },
        { label: "Endorsement / Cancellation", value: "endorsementCancellation" },
      ],

      governmentTypeOptions: [
        { label: "خصوصي — Private", value: "01" },
        { label: "نقل خاص — PVT Goods Vehicle", value: "02" },
        { label: "مشترك خاص — PVT D/C Pickup", value: "03" },
        { label: "خاص للركاب — PVT Passengers", value: "04" },
        { label: "للتأجير — For Hire", value: "05" },
        { label: "عام مشترك — Public D/C Pickup", value: "06" },
        { label: "عام للركاب — Public Transport", value: "07" },
        { label: "باص سياحي — Tourist Bus", value: "08" },
        { label: "دراجه نارية — Motor Cycle", value: "09" },
        { label: "للمقاولات — Contractors", value: "10" },
        { label: "استعمال خاص — Special use", value: "11" },
        { label: "الديوان — Royal Court", value: "12" },
        { label: "هيئه سياسية — Diplomatic", value: "13" },
        { label: "شبه مقطورة — Semi Trailer", value: "14" },
        { label: "مقطورة — Trailer", value: "15" },
      ],

      form: {
        company: null,
        template: null,
        subject: "",
        to: [],
        cc: [],
        attachments: null,
        attachmentMode: "merge",
        content: "",
      },

      formInputs: {
        customerName: "",
        customerCPR: "",
        underCompanyName: false,
        plateNo: "",
        chassisNo: "",
        startDate: "",
        expiryDate: "",
        governmentType: null,
        endorsementType: "",
        reason: "",
        effectiveDate: "",
      },

      editorToolbar: [
        ["bold", "italic", "underline", "strike"],
        ["left", "center", "right", "justify"],
        ["undo", "redo"],
        ["unordered", "ordered"],
        ["link"],
        ["removeFormat"],
        ["viewsource"],
      ],
    };
  },

  computed: {
    companyOptions() {
      return this.companies.map((c) => ({
        label: c.name,
        value: c.id,
      }));
    },

    isReadyToSend() {
      return (
        !!this.form.company &&
        !!this.form.template &&
        this.form.to.length > 0 &&
        !!this.form.content
      );
    },

    totalFileSize() {
      if (!this.form.attachments || this.form.attachments.length === 0)
        return "0.00 MB";
      const bytes = Array.isArray(this.form.attachments)
        ? this.form.attachments.reduce((sum, f) => sum + (f.size || 0), 0)
        : this.form.attachments.size || 0;
      return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    },
    toOptions() {
      return this.form.to ?? [];
    },

    ccOptions() {
      return this.form.cc ?? [];
    },

    attachmentList() {
      if (!this.form.attachments) return [];
      return Array.isArray(this.form.attachments)
        ? this.form.attachments
        : [this.form.attachments];
    },
  },

  watch: {
    "form.company"(newId) {
      if (!newId) {
        this.form.to = [];
        this.form.cc = [];
        return;
      }
      const company = this.companies.find((c) => c.id === newId);
      if (company) {
        this.form.to = [...company.to];
        this.form.cc = [...company.cc];
      }
    },

    "form.template"(newValue) {
      if (newValue) {
        this.setTemplateSubject();
        this.renderSelectedTemplate();
      } else {
        this.form.subject = "";
        this.form.content = "";
      }
    },

    formInputs: {
      handler() {
        if (this.form.template) {
          this.renderSelectedTemplate();
        }
      },
      deep: true,
    },

    attachmentList(files) {
      this.refreshPreviewUrls(files);
    },

    lightboxOpen(val) {
      if (val) {
        document.addEventListener("keydown", this._lightboxKey);
      } else {
        document.removeEventListener("keydown", this._lightboxKey);
      }
    },
  },

  methods: {
    onFieldsConfirmed(fields) {
      // Non-customer fields: simple 1-to-1 mapping
      // Dates are intentionally excluded — let Bahrain Traffic Lookup fill them
      const simpleMap = {
        vehicle_reg_number: "plateNo",
        chassis_number: "chassisNo",
      };
      for (const [ocrKey, formKey] of Object.entries(simpleMap)) {
        if (fields[ocrKey] == null) continue;
        const isDate = formKey === "startDate" || formKey === "expiryDate";
        this.formInputs[formKey] = isDate
          ? this.toInputDate(fields[ocrKey])
          : fields[ocrKey];
      }

      // registration_type → governmentType
      if (fields.registration_type) {
        const REG_TYPE_MAP = [
          { keywords: ['semi trailer'],                         value: '14' },
          { keywords: ['trailer'],                              value: '15' },
          { keywords: ['pvt goods', 'pvt good'],               value: '02' },
          { keywords: ['pvt d/c', 'pvt pickup', 'mshtrk'],     value: '03' },
          { keywords: ['pvt passenger', 'pvt transport'],       value: '04' },
          { keywords: ['public d/c'],                          value: '06' },
          { keywords: ['public transport', 'public'],          value: '07' },
          { keywords: ['private', 'khsosy', 'خصوصي'],          value: '01' },
          { keywords: ['for hire'],                            value: '05' },
          { keywords: ['tourist'],                             value: '08' },
          { keywords: ['motor cycle', 'motorcycle', 'motor'],  value: '09' },
          { keywords: ['contractor'],                          value: '10' },
          { keywords: ['special'],                             value: '11' },
          { keywords: ['royal'],                               value: '12' },
          { keywords: ['diplomatic'],                          value: '13' },
        ];
        const key = fields.registration_type.toLowerCase();
        const matchedType = REG_TYPE_MAP.find(e => e.keywords.some(k => key.includes(k)));
        if (matchedType) this.formInputs.governmentType = matchedType.value;
      }

      // ── Policy holder derivation (3 cases from ownership cert) ────────────
      const ownerName       = fields.owner_name || fields.full_name || "";
      const cprNumber       = fields.cpr_number    || "";
      const crNumber        = fields.cr_number     || "";
      const ownershipStatus = fields.ownership_status; // 'cash' | 'installment' | null

      const BANK_KEYWORDS = [
        "BANK","FINANCE","FINANCIAL","CREDIT","FACILITIES","FINANCING",
        "NBB","BBK","AUB","GIB","KFH","BISB","KHCB","FAB","BCF",
        "BAHRAIN CREDIT",
      ];
      const COMPANY_SUFFIXES = ["WLL","BSC","SPC","LLC","LTD","LIMITED","B.S.C","W.L.L","S.P.C"];

      const ownerIsBank    = ownerName && BANK_KEYWORDS.some(k => ownerName.toUpperCase().includes(k));
      const ownerIsCompany = ownerName && COMPANY_SUFFIXES.some(s => ownerName.toUpperCase().includes(s));
      const isInstallment  = ownershipStatus === "installment";
      const personalId     = fields.personal_id_number || "";
      const cprDigits      = cprNumber.replace(/\D/g, "");
      // CR number: not exactly 9 digits, OR doesn't match the civil ID personal ID number
      const cprIsCompany   = cprDigits.length > 0 && cprDigits.length !== 9;
      const cprMismatch    = !!(personalId && cprNumber && personalId !== cprNumber);
      const ownerIsEntity  = ownerIsBank || ownerIsCompany || !!crNumber || cprIsCompany || cprMismatch;

      if (ownerIsEntity) {
        // Case 3: company / bank is the registered owner (entity signals alone are sufficient)
        this.formInputs.customerName     = ownerName;
        this.formInputs.customerCPR      = crNumber || cprNumber;
        this.formInputs.underCompanyName = true;
      } else if (isInstallment) {
        // Case 2: installment + individual customer name
        this.formInputs.customerName     = ownerName;
        this.formInputs.customerCPR      = cprNumber;
        this.formInputs.underCompanyName = false;
      } else {
        // Case 1: cash / individual ownership
        this.formInputs.customerName     = ownerName;
        this.formInputs.customerCPR      = cprNumber;
        this.formInputs.underCompanyName = false;
      }

      if (fields._cpr_mismatch_warning) {
        this.$q.notify({
          type: "warning",
          message: fields._cpr_mismatch_warning,
          icon: "warning",
          timeout: 8000,
        });
      }
      this.$q.notify({
        type: "positive",
        message: "Fields applied from OCR documents",
        icon: "auto_fix_high",
        timeout: 3000,
      });
    },

    toInputDate(raw) {
      if (!raw) return "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
      const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      return raw;
    },
    // ─────────────────────────────────────────────────────────────────────

    getGovernmentTypeLabel() {
      const selected = this.governmentTypeOptions.find(
        (item) => item.value === this.formInputs.governmentType,
      );
      return selected ? selected.label : "";
    },

    async handleAuthEmail() {
      this.authZoho();
      this.$q.notify({
        type: "info",
        message:
          "Zoho login opened — complete login in the new tab, then return here. Session lasts 55 minutes.",
        icon: "lock",
        timeout: 6000,
      });
    },

    async handleSendEmail() {
      if (!this.isReadyToSend) return;

      // Session check before anything
      if (!this.isTokenValid()) {
        this.clearSession();
        this.$q.notify({
          type: "warning",
          message:
            "Your Zoho session has expired. Click Auth Email to reconnect.",
          icon: "timer_off",
          timeout: 8000,
          actions: [
            {
              label: "Re-authorise now",
              color: "white",
              handler: () => this.handleAuthEmail(),
            },
          ],
        });
        return;
      }

      this.sending = true;
      try {
        const attachments = this.form.attachments
          ? Array.isArray(this.form.attachments)
            ? this.form.attachments
            : [this.form.attachments]
          : [];

        const companyName =
          this.companies.find((c) => c.id === this.form.company)?.name || "";

        const { zohoMessageId } = await this.sendEmail({
          to:             this.form.to,
          cc:             this.form.cc,
          subject:        this.form.subject,
          content:        this.form.content,
          attachments,
          attachmentMode: this.form.attachmentMode,
          company:        companyName,
          template:       this.form.template || "",
        });

        await this.saveSentEmail({
          to:              this.form.to,
          cc:              this.form.cc,
          subject:         this.form.subject,
          template:        this.form.template,
          companyId:       this.form.company,
          companyName,
          attachmentCount: attachments.length,
          user:            localStorage.getItem("siem_user_email") || "staff",
          zohoMessageId:   zohoMessageId || null,
        });

        const siemUser = localStorage.getItem("siem_user_email") || "staff";
        const toList   = Array.isArray(this.form.to) ? this.form.to : [this.form.to];
        await logSiemEvent("EMAIL_SENT", siemUser, {
          count:      1,
          recipients: toList.length,
          company:    companyName,
          template:   this.form.template || "",
          message:    `Email sent to ${toList.join(", ")}`,
        }, "low");

        this.$q.notify({
          type: "positive",
          message: "Email sent successfully",
          icon: "send",
        });
      } catch (err) {
        if (err.message === "SESSION_EXPIRED") {
          this.clearSession();
          this.$q.notify({
            type: "warning",
            message: "Zoho session expired. Please re-authorise.",
            icon: "timer_off",
            timeout: 8000,
            actions: [
              {
                label: "Re-authorise now",
                color: "white",
                handler: () => this.handleAuthEmail(),
              },
            ],
          });
        } else {
          this.$q.notify({
            type: "negative",
            message: err.message || "Failed to send email",
            icon: "error",
          });
        }
      } finally {
        this.sending = false;
      }
    },

    setInfoInMail() {
      if (!this.form.template) {
        this.$q.notify({
          type: "warning",
          message: "Please select a template first",
          icon: "warning",
        });
        return;
      }
      this.renderSelectedTemplate();
      this.$q.notify({
        type: "positive",
        message: "Template updated with latest form data",
        icon: "auto_fix_high",
      });
    },

    setTemplateSubject() {
      if (this.form.template === 'endorsementCancellation') {
        if (!this.formInputs.endorsementType) this.formInputs.endorsementType = 'endorsement'
        this.form.subject = this.formInputs.endorsementType === 'cancellation'
          ? 'Policy Cancellation Request'
          : 'Policy Endorsement Request'
        return
      }
      const subjects = {
        specialApproval: "Special Approval Request",
        issueNewPolicy: "Issue New Policy Request",
        changeIssuedCover: "Change Issued Cover Request",
        policyTransfer: "Policy Transfer Request",
      };
      this.form.subject = subjects[this.form.template] || "";
    },

    renderSelectedTemplate() {
      if (!this.form.template) {
        this.form.content = "";
        return;
      }

      const isEndorsement = this.form.template === 'endorsementCancellation'
      const templateFn = isEndorsement
        ? endorsementCancellation
        : emailTemplates[this.form.template]

      if (!templateFn) {
        this.form.content = `
          <div class="email-template">
            <p style="color:#dc2626;font-weight:600;">Template not found.</p>
          </div>
        `;
        return;
      }

      // Keep subject in sync with endorsement vs cancellation switch
      if (isEndorsement) {
        this.form.subject = this.formInputs.endorsementType === 'cancellation'
          ? 'Policy Cancellation Request'
          : 'Policy Endorsement Request'
      }

      this.form.content = templateFn({
        customerName: this.formInputs.customerName,
        customerCPR: this.formInputs.customerCPR,
        plateNo: this.formInputs.plateNo,
        chassisNo: this.formInputs.chassisNo,
        startDate: this.formInputs.startDate,
        expiryDate: this.formInputs.expiryDate,
        governmentType: this.getGovernmentTypeLabel(),
        underCompanyName: this.formInputs.underCompanyName,
        endorsementType: this.formInputs.endorsementType,
        reason: this.formInputs.reason,
        effectiveDate: this.formInputs.effectiveDate,
      });
    },

    async openTraffic() {
      const { customerCPR, plateNo, governmentType, underCompanyName } =
        this.formInputs;
      if (!customerCPR || !plateNo) {
        this.$q.notify({
          type: "warning",
          message: "CPR/CR and Plate No must be filled first",
          icon: "warning",
        });
        return;
      }
      this.$q.notify({
        type: "info",
        message: "Genie is running... Firefox will open automatically",
        icon: "smart_toy",
        timeout: 8000,
      });
      const result = await this.runLookup({
        cpr: customerCPR,
        plateno: plateNo,
        company: underCompanyName,
        regTypeID: governmentType || "01",
      });
      if (!result) {
        this.$q.notify({
          type: "negative",
          message:
            this.lookupError ||
            "Traffic lookup failed — is the Genie server running?",
          icon: "error",
          timeout: 6000,
        });
        return;
      }
      const v = result.vehicleData;
      if (v) {
        if (v.chassisNo) this.formInputs.chassisNo = v.chassisNo;
        if (v.plateNo)   this.formInputs.plateNo   = v.plateNo;
        if (v.regExpiry) this.formInputs.expiryDate = v.regExpiry;
        if (v.regType) {
          const upper = v.regType.toUpperCase();
          const REG_KEYWORD_MAP = [
            { keywords: ['SEMI TRAILER'],                    value: '14' },
            { keywords: ['TRAILER'],                         value: '15' },
            { keywords: ['PVT GOODS'],                       value: '02' },
            { keywords: ['PVT D/C'],                         value: '03' },
            { keywords: ['PVT PASSENGER', 'PVT TRANSPORT'],  value: '04' },
            { keywords: ['PUBLIC D/C'],                      value: '06' },
            { keywords: ['PUBLIC'],                          value: '07' },
            { keywords: ['PRIVATE'],                         value: '01' },
            { keywords: ['FOR HIRE'],                        value: '05' },
            { keywords: ['TOURIST'],                         value: '08' },
            { keywords: ['MOTOR'],                           value: '09' },
            { keywords: ['CONTRACTOR'],                      value: '10' },
            { keywords: ['SPECIAL'],                         value: '11' },
            { keywords: ['ROYAL'],                           value: '12' },
            { keywords: ['DIPLOMATIC'],                      value: '13' },
          ];
          const match = REG_KEYWORD_MAP.find(e => e.keywords.some(k => upper.includes(k)));
          if (match) this.formInputs.governmentType = match.value;
        }
      }

      // Convert base64 string → File without fetch (avoids data-URI size limits)
      const b64ToFile = (b64, name, mime) => {
        const bytes = atob(b64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        return new File([arr], name, { type: mime });
      };
      const newFiles = [];
      const ts = Date.now();
      console.log('[Traffic] screenshotData count:', result.screenshotData?.length, '| pdfData:', !!result.pdfData);
      for (let i = 0; i < (result.screenshotData || []).length; i++) {
        const f = b64ToFile(result.screenshotData[i], `traffic_screenshot_${ts}_${i + 1}.png`, 'image/png');
        console.log(`[Traffic] screenshot ${i + 1}: ${f.size} bytes`);
        newFiles.push(f);
      }
      if (result.pdfData) {
        const f = b64ToFile(result.pdfData, `traffic_report_${ts}.pdf`, 'application/pdf');
        console.log(`[Traffic] pdf: ${f.size} bytes`);
        newFiles.push(f);
      }
      if (newFiles.length > 0) {
        const existing = Array.isArray(this.form.attachments) ? this.form.attachments : [];
        this.form.attachments = [...existing, ...newFiles];
      }

      this.$q.notify({
        type: "positive",
        message: `Traffic report ready — fields filled${newFiles.length ? `, ${newFiles.length} file(s) added to attachments` : ''}`,
        icon: "check_circle",
        timeout: 6000,
      });
    },

    resetForm() {
      if (!window.confirm("Are you sure you want to clear all fields?")) return;
      this.form = {
        company: null,
        template: null,
        subject: "",
        to: [],
        cc: [],
        attachments: null,
        attachmentMode: "merge",
        content: "",
      };
      this.formInputs = {
        customerName: "",
        customerCPR: "",
        underCompanyName: false,
        plateNo: "",
        chassisNo: "",
        startDate: "",
        expiryDate: "",
        governmentType: null,
        endorsementType: "",
        reason: "",
        effectiveDate: "",
      };
    },

    isImageFile(file) {
      return file.type.startsWith("image/");
    },

    fileTypeIcon(file) {
      if (file.type === "application/pdf") return "picture_as_pdf";
      if (file.type.startsWith("text/")) return "description";
      if (file.type.includes("word") || file.type.includes("document")) return "article";
      if (file.type.includes("excel") || file.type.includes("spreadsheet")) return "table_chart";
      return "insert_drive_file";
    },

    formatFileSize(bytes) {
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
      return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    },

    removeAttachment(idx) {
      if (this.previewUrls[idx]) URL.revokeObjectURL(this.previewUrls[idx]);
      const arr = [...this.attachmentList];
      arr.splice(idx, 1);
      this.form.attachments = arr.length ? arr : null;
    },

    onAttachmentsChange(files) {
      if (!files) return;
      const list = Array.isArray(files) ? files : [files];
      const accepted = [];
      for (const file of list) {
        const result = validateFile(file, 'email');
        if (!result.ok) {
          this.$q.notify({
            type:    'negative',
            message: `${file.name} rejected — ${result.reason}`,
            icon:    'block',
            timeout: 6000,
          });
          logSiemEvent('FILE_REJECTED', localStorage.getItem('siem_user_email') || 'staff', {
            filename: file.name,
            reason:   result.reason,
          }, 'medium');
        } else {
          accepted.push(file);
        }
      }
      if (accepted.length) {
        const totalBytes = accepted.reduce((sum, f) => sum + f.size, 0);
        logSiemEvent('FILE_UPLOAD', localStorage.getItem('siem_user_email') || 'staff', {
          filename:        accepted.map(f => f.name).join(', '),
          totalSizeBytes:  totalBytes,
          sizeMB:          parseFloat((totalBytes / 1024 / 1024).toFixed(2)),
          message:         `${accepted.length} file(s) attached to email`,
        }, 'low');
      }
      this.form.attachments = accepted.length ? accepted : null;
    },

    refreshPreviewUrls(files) {
      this.previewUrls.forEach((u) => { if (u) URL.revokeObjectURL(u); });
      this.previewUrls = files.map((f) => URL.createObjectURL(f));
    },

    openLightbox(i) {
      this.lightboxIndex = i;
      this.lightboxOpen = true;
    },

    _lightboxKey(e) {
      if (e.key === "ArrowLeft" && this.lightboxIndex > 0) this.lightboxIndex--;
      else if (e.key === "ArrowRight" && this.lightboxIndex < this.attachmentList.length - 1) this.lightboxIndex++;
      else if (e.key === "Escape") this.lightboxOpen = false;
    },
  },

  beforeUnmount() {
    this.previewUrls.forEach((u) => { if (u) URL.revokeObjectURL(u); });
    document.removeEventListener("keydown", this._lightboxKey);
  },
};
</script>

<style scoped>
/* ── PAGE ── */
.send-email-page {
  background: #eef2fb;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── GRID ── */
.composer-grid {
  display: grid;
  grid-template-columns: 290px 1fr 340px;
  grid-template-rows: 1fr;
  gap: 16px;
  flex: 1;
  height: calc(100vh - 50px - 32px);
  min-height: 0;
  overflow: hidden;
}

/* ── CARDS ── */
.composer-card {
  border-radius: 16px !important;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: #ffffff !important;
  border-color: rgba(0, 0, 0, 0.07) !important;
  box-shadow: 0 2px 8px rgba(15, 31, 61, 0.06) !important;
}
.card-header-section {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px 11px !important;
  flex-shrink: 0;
}
.card-header-left {
  flex: 1;
  min-width: 0;
}
.card-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f1f3d;
}
.card-subtitle {
  font-size: 11px;
  color: #8492a6;
  margin-top: 2px;
}
.card-subtitle--template {
  display: flex;
  align-items: center;
  gap: 4px;
}
.card-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.icon-blue {
  background: #eff6ff;
  color: #2563eb;
}
.icon-teal {
  background: #f0fdfa;
  color: #0d9488;
}
.icon-purple {
  background: #f5f3ff;
  color: #7c3aed;
}

/* ── STEP BADGES ── */
.step-badge {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1.5px solid #bfdbfe;
}
.step-badge--purple {
  background: #f5f3ff;
  color: #7c3aed;
  border-color: #ddd6fe;
}

/* ── INNER SECTION LABELS ── */
.inner-section-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 9.5px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  padding: 6px 0 2px;
  border-bottom: 1px solid #f1f5f9;
  margin-bottom: 2px;
}

.soft-sep {
  opacity: 0.5;
}
.field-sep {
  margin: 4px 0 !important;
  opacity: 0.4;
}

/* ── SCROLLABLE BODY ── */
.card-scroll-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px !important;
}
.card-scroll-body::-webkit-scrollbar {
  width: 4px;
}
.card-scroll-body::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}

/* ── FIELD LABELS ── */
.field-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.field-label {
  font-size: 10px;
  font-weight: 700;
  color: #4b5a7a;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ── STYLED INPUTS ── */
.styled-input :deep(.q-field__control),
.styled-select :deep(.q-field__control) {
  border-radius: 9px !important;
  background: #f8faff !important;
}
.styled-input :deep(.q-field--outlined .q-field__control:hover:before),
.styled-select :deep(.q-field--outlined .q-field__control:hover:before) {
  border-color: #93c5fd !important;
}
.styled-input :deep(.q-field--focused .q-field__control:before),
.styled-select :deep(.q-field--focused .q-field__control:before) {
  border-color: #2563eb !important;
}

/* ── CHIPS ── */
.chips-select :deep(.q-chip) {
  border-radius: 20px !important;
  height: 22px !important;
  font-size: 11px !important;
}
.email-chip {
  font-size: 11px !important;
  border-radius: 20px !important;
}

/* ── ATTACH MODE ── */
.attach-mode-row {
  display: flex;
  gap: 8px;
}
.mode-option {
  flex: 1;
  padding: 8px 10px;
  border: 1.5px solid rgba(37, 99, 235, 0.15);
  border-radius: 9px;
  font-size: 12px;
  font-weight: 600;
  color: #4b5a7a;
  cursor: pointer;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  background: #f8faff;
  transition: all 0.15s;
}
.mode-option:hover {
  border-color: #93c5fd;
  color: #2563eb;
}
.mode-active {
  border-color: #2563eb !important;
  color: #2563eb !important;
  background: #eff6ff !important;
}

/* ── EDITOR ── */
.editor-card {
  overflow: hidden;
}
.editor-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 12px !important;
}
.tg-editor {
  flex: 1;
  min-height: 0;
  border-radius: 12px !important;
  overflow: hidden;
  border: 1.5px solid rgba(37, 99, 235, 0.12) !important;
  display: flex;
  flex-direction: column;
}
:deep(.tg-editor .q-editor__toolbars-container) {
  flex-shrink: 0;
}
:deep(.tg-editor .q-editor__toolbar) {
  background: #f8faff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06) !important;
  border-radius: 0 !important;
}
:deep(.tg-editor .q-editor__content) {
  font-size: 13.5px;
  line-height: 1.7;
  color: #0f1f3d;
  padding: 16px;
  flex: 1 1 0;
  height: 0;
  overflow-y: auto !important;
}

/* ── ACTION BAR ── */
.action-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px !important;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  background: #ffffff;
  flex-shrink: 0;
}
.action-btn {
  border-radius: 9px !important;
  font-weight: 600 !important;
  font-size: 12px !important;
  min-height: 36px !important;
}
.auth-btn {
  min-width: 130px;
}
.send-btn {
  min-width: 130px;
  box-shadow: 0 4px 12px rgba(22, 163, 74, 0.25) !important;
}

/* ── RIGHT COLUMN ── */
.right-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  height: 100%;
}
.right-col::-webkit-scrollbar {
  width: 4px;
}
.right-col::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}

/* ── POLICY DETAIL INPUTS ── */
.input-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.company-check {
  font-size: 12px !important;
  padding: 2px 0;
}
.full-width-btn {
  width: 100%;
  border-radius: 9px !important;
  font-weight: 700 !important;
  font-size: 12px !important;
  min-height: 36px !important;
}
.file-hint {
  font-size: 11px;
  color: #8492a6;
}

:deep(.tg-editor .q-editor__content .email-template) {
  background: #ffffff;
  border: 1px solid #dbe7ff;
  border-radius: 14px;
  padding: 22px;
  max-width: 760px;
  margin: 0 auto;
  box-shadow: 0 8px 24px rgba(37, 99, 235, 0.06);
  font-family: "Segoe UI", Arial, sans-serif;
  color: #1e293b;
}

:deep(.tg-editor .q-editor__content .email-badge) {
  display: inline-block;
  background: linear-gradient(135deg, #eff6ff, #dbeafe);
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 700;
  padding: 6px 10px;
  border-radius: 999px;
  margin-bottom: 12px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}

:deep(.tg-editor .q-editor__content .email-template h2) {
  margin: 0 0 14px;
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
}

:deep(.tg-editor .q-editor__content .email-greeting) {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 600;
  color: #1e3a8a;
}

:deep(.tg-editor .q-editor__content .email-text),
:deep(.tg-editor .q-editor__content .email-footer-text) {
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.8;
  color: #334155;
}

:deep(.tg-editor .q-editor__content .email-table) {
  width: 100%;
  border-collapse: collapse;
  margin: 18px 0;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid #dbeafe;
}

:deep(.tg-editor .q-editor__content .email-table tr:nth-child(odd)) {
  background: #f8fbff;
}

:deep(.tg-editor .q-editor__content .email-table tr:nth-child(even)) {
  background: #ffffff;
}

:deep(.tg-editor .q-editor__content .email-table td) {
  border: 1px solid #e2e8f0;
  padding: 12px 14px;
  font-size: 13px;
  vertical-align: top;
}

:deep(.tg-editor .q-editor__content .email-table td:first-child) {
  width: 32%;
  font-weight: 700;
  color: #1e3a8a;
  background: #eff6ff;
}

:deep(.tg-editor .q-editor__content .email-signature) {
  margin-top: 26px;
  padding-top: 14px;
  border-top: 1px dashed #cbd5e1;
  font-size: 14px;
  color: #334155;
}

:deep(.tg-editor .q-editor__content .email-signature p) {
  margin: 4px 0;
}

/* ── ATTACHMENT PREVIEWS ── */
.attach-preview-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}
.attach-preview-card {
  position: relative;
  width: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: #f8faff;
  border: 1.5px solid #dbeafe;
  border-radius: 10px;
  padding: 6px 6px 5px;
  flex-shrink: 0;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
}
.attach-preview-card:hover {
  transform: scale(1.05);
  border-color: #93c5fd;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.18);
}
.attach-preview-thumb {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 7px;
  display: block;
}
.attach-preview-icon-wrap {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eff6ff;
  border-radius: 7px;
  flex-shrink: 0;
}
.attach-preview-name {
  font-size: 9px;
  font-weight: 600;
  color: #4b5a7a;
  text-align: center;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}
.attach-preview-size {
  font-size: 8.5px;
  color: #94a3b8;
  line-height: 1;
}
.attach-remove-btn {
  position: absolute !important;
  top: -6px !important;
  right: -6px !important;
  width: 18px !important;
  height: 18px !important;
  min-width: 18px !important;
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 50% !important;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12) !important;
}

/* ── LIGHTBOX ── */
.lightbox-overlay {
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.93);
  display: flex;
  flex-direction: column;
  outline: none;
}
.lightbox-topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: rgba(0, 0, 0, 0.45);
  flex-shrink: 0;
}
.lightbox-filename {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lightbox-counter {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
}
.lightbox-body {
  flex: 1;
  display: flex;
  align-items: center;
  min-height: 0;
  padding: 8px 0;
}
.lightbox-nav-btn {
  width: 52px !important;
  height: 52px !important;
  flex-shrink: 0;
  margin: 0 12px;
  background: rgba(255, 255, 255, 0.08) !important;
  border-radius: 50% !important;
  transition: background 0.15s !important;
}
.lightbox-nav-btn:not(:disabled):hover {
  background: rgba(255, 255, 255, 0.18) !important;
}
.lightbox-content {
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.lightbox-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 6px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
}
.lightbox-pdf {
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 4px;
}
.lightbox-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}
.lightbox-fallback-name {
  font-size: 16px;
  font-weight: 600;
  color: #e2e8f0;
}
.lightbox-fallback-size {
  font-size: 13px;
  color: #64748b;
}

/* ── RESPONSIVE ── */
@media (max-width: 1300px) {
  .composer-grid {
    grid-template-columns: 260px 1fr 250px;
  }
}
@media (max-width: 1100px) {
  .composer-grid {
    grid-template-columns: 1fr;
    height: auto;
  }
  .composer-card {
    height: auto;
    min-height: 300px;
  }
  .editor-card {
    min-height: 500px;
  }
  .right-col {
    height: auto;
  }
}
</style>
