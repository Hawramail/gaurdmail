<template>
  <q-page class="send-email-page">
    <!-- ── THREE-COLUMN GRID ── -->
    <div class="composer-grid q-pa-md">
      <!-- ══ COLUMN 1: EMAIL CONFIGURATION ══ -->
      <q-card flat bordered class="composer-card config-card">
        <q-card-section class="card-header-section">
          <div class="card-header-left">
            <div class="card-title">Email Configuration</div>
            <div class="card-subtitle">Company, template, and recipients</div>
          </div>
          <div class="card-icon-wrap icon-blue">
            <q-icon name="tune" size="18px" />
          </div>
        </q-card-section>

        <q-separator class="soft-sep" />

        <q-card-section class="card-scroll-body q-gutter-sm">
          <!-- Company -->
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

          <!-- Template -->
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

          <!-- Subject -->
          <div class="field-wrap">
            <div class="field-label">Subject</div>
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

          <q-separator class="field-sep" />

          <!-- To -->
          <div class="field-wrap">
            <div class="field-label">To (Recipients)</div>
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

          <!-- CC -->
          <div class="field-wrap">
            <div class="field-label">CC (Carbon Copy)</div>
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

          <q-separator class="field-sep" />

          <!-- Attachments -->
          <div class="field-wrap">
            <div class="field-label">Attachments</div>
            <q-file
              v-model="form.attachments"
              outlined
              dense
              multiple
              use-chips
              clearable
              placeholder="Drop files or click to upload"
              class="styled-input"
            >
              <template #prepend>
                <q-icon name="attach_file" color="primary" size="16px" />
              </template>
              <template #hint>
                <span class="file-hint">
                  {{ form.attachments ? form.attachments.length : 0 }} file(s) ·
                  {{ totalFileSize }}
                </span>
              </template>
            </q-file>
          </div>

          <!-- Attachment mode -->
          <div class="field-wrap">
            <div class="field-label">Attachment Mode</div>
            <div class="attach-mode-row">
              <div
                class="mode-option"
                :class="{ 'mode-active': form.attachmentMode === 'merge' }"
                @click="form.attachmentMode = 'merge'"
              >
                <q-icon name="merge_type" size="15px" />
                Merged PDF
              </div>
              <div
                class="mode-option"
                :class="{ 'mode-active': form.attachmentMode === 'separate' }"
                @click="form.attachmentMode = 'separate'"
              >
                <q-icon name="call_split" size="15px" />
                Separate Files
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- ══ COLUMN 2: EMAIL EDITOR ══ -->
      <q-card flat bordered class="composer-card editor-card">
        <q-card-section class="card-header-section">
          <div class="card-header-left">
            <div class="card-title">Email Content Editor</div>
            <div class="card-subtitle">
              {{ form.template || "No template selected" }}
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px">
            <div class="card-icon-wrap icon-blue">
              <q-icon name="edit_note" size="18px" />
            </div>
          </div>
        </q-card-section>

        <q-separator class="soft-sep" />

        <!-- Rich text editor -->
        <q-card-section class="editor-body q-pa-md">
          <q-editor
            v-model="form.content"
            :toolbar="editorToolbar"
            min-height="100%"
            class="tg-editor"
            placeholder="Email content will appear here after selecting a template..."
          />
        </q-card-section>

        <q-separator class="soft-sep" inset />

        <!-- Action bar -->
        <q-card-section class="action-bar q-pt-sm">
          <q-btn
            unelevated
            color="primary"
            label="Auth Email"
            icon="lock"
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
            label="Reset"
            icon="clear"
            no-caps
            class="action-btn"
            @click="resetForm"
          />
        </q-card-section>
      </q-card>

      <!-- ══ COLUMN 3: OCR + FORM INPUTS (single card) ══ -->
      <div class="right-col">
        <q-card flat bordered class="composer-card">
          <!-- OCR HEADER -->
          <q-card-section class="ocr-section q-gutter-sm">
            <div class="card-header-left">
              <div class="card-title">OCR File Reader</div>
              <div class="card-subtitle">Attach files to read in OCR</div>
            </div>
            <div class="card-icon-wrap icon-teal">
              <q-icon name="document_scanner" size="18px" />
            </div>
          </q-card-section>

          <q-separator class="soft-sep" />

          <!-- ═══════════════════════════════════════════════════════════════
               OCR BODY — CHANGED: wired to useOcr composable
               ═══════════════════════════════════════════════════════════ -->
          <q-card-section class="q-gutter-sm">
            <!-- removed: multiple / use-chips  added: @update:model-value -->
            <q-file
              v-model="form.ocrFiles"
              outlined
              dense
              clearable
              accept=".png,.jpg,.jpeg,.bmp,.tiff,.webp,.pdf"
              class="styled-input"
              @update:model-value="(val) => onOcrFileSelected(val || null)"
            >
              <template #prepend>
                <q-icon name="upload_file" color="teal-6" size="16px" />
              </template>
              <template #label>
                <span style="font-size: 12px">Upload for OCR extraction</span>
              </template>
            </q-file>

            <!-- determinate progress bar while scanning -->
            <q-linear-progress
              v-if="ocrLoading"
              :value="ocrProgress / 100"
              color="teal"
              track-color="teal-1"
              style="border-radius: 4px"
            />

            <!-- status banner: idle / loading / error / success -->
            <q-banner rounded class="ocr-banner" :class="ocrBannerClass">
              <template #avatar>
                <q-icon
                  :name="ocrBannerIcon"
                  :color="ocrBannerIconColor"
                  size="18px"
                />
              </template>
              <span class="ocr-banner-text">{{ ocrStatusMessage }}</span>
            </q-banner>

            <!-- raw text fallback — only shown when OCR ran but matched nothing -->
            <div v-if="ocrRawText && ocrFoundCount === 0 && !ocrError" class="ocr-raw-wrap">
              <div class="ocr-raw-label">No fields matched — raw OCR text:</div>
              <div class="ocr-raw-text">{{ ocrRawText }}</div>
            </div>

            <div v-if="ocrFoundCount > 0" class="ocr-fields-wrap">
              <div class="ocr-fields-header">
                <span class="ocr-fields-title">
                  {{ ocrFoundCount }} field{{ ocrFoundCount !== 1 ? "s" : "" }}
                  found
                </span>
                <q-btn
                  flat
                  dense
                  size="xs"
                  color="teal-7"
                  icon="auto_fix_high"
                  label="Apply all"
                  no-caps
                  @click="applyAllOcrFields"
                />
              </div>
              <div class="ocr-chip-grid">
                <div
                  v-for="(value, key) in ocrNonNullFields"
                  :key="key"
                  class="ocr-chip"
                  :class="{ 'ocr-chip--applied': ocrApplied.has(key) }"
                  @click="applySingleOcrField(key, value)"
                >
                  <div class="ocr-chip__label">{{ ocrFieldLabel(key) }}</div>
                  <div class="ocr-chip__value">{{ value }}</div>
                  <q-icon
                    class="ocr-chip__icon"
                    :name="ocrApplied.has(key) ? 'check' : 'add'"
                    size="12px"
                  />
                </div>
              </div>
            </div>
          </q-card-section>
          <!-- ═══════════════════════════════════════════════════════════ -->

          <!-- DIVIDER between OCR and Form Inputs -->
          <q-separator class="soft-sep" />

          <!-- FORM INPUTS HEADER -->
          <q-card-section class="card-header-section">
            <div class="card-header-left">
              <div class="card-title">Form Inputs</div>
              <div class="card-subtitle">Fill details for the template</div>
            </div>
            <div class="card-icon-wrap icon-purple">
              <q-icon name="edit_square" size="18px" />
            </div>
          </q-card-section>

          <q-separator class="soft-sep" />

          <!-- FORM INPUTS BODY -->
          <q-card-section class="card-scroll-body q-gutter-sm">
            <q-btn
              unelevated
              color="teal-7"
              icon="document_scanner"
              label="Upload & Extract"
              no-caps
              class="full-width-btn"
              @click="ocrDialogOpen = true"
            />

            <q-separator class="field-sep" />

            <q-input
              v-model="formInputs.customerName"
              outlined
              dense
              label="Customer Name"
              class="styled-input"
            />

            <q-input
              v-model="formInputs.customerCPR"
              outlined
              dense
              label="Customer CPR / CR"
              class="styled-input"
            />

            <q-checkbox
              v-model="formInputs.underCompanyName"
              label="Under Company Name"
              color="primary"
              dense
              class="company-check"
            />

            <div class="input-row">
              <q-input
                v-model="formInputs.plateNo"
                outlined
                dense
                label="Plate No"
                class="styled-input"
              />
              <q-input
                v-model="formInputs.chassisNo"
                outlined
                dense
                label="Chassis No"
                class="styled-input"
              />
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
              label="Government Type"
              clearable
              class="styled-select"
            >
              <template #prepend>
                <q-icon name="flag" color="primary" size="16px" />
              </template>
            </q-select>

            <q-btn
              unelevated
              color="dark"
              label="Set Info in Mail"
              icon="auto_fix_high"
              no-caps
              class="full-width-btn q-mt-xs"
              @click="setInfoInMail"
            />

            <q-btn
              unelevated
              color="negative"
              label="Open Traffic"
              icon="traffic"
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
  </q-page>
</template>

<script>
import { emailTemplates } from "src/data/emailTemplates";
import { useCompanies } from "src/composables/useCompanies";
import { useZoho } from "src/composables/useZoho";
import { useSentEmails } from "src/composables/useSentEmails";
import { useOcr } from "src/composables/useOcr";
import OcrUploadDialog from "src/components/OcrUploadDialog.vue";

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

    // ── CHANGED: wire useOcr ──────────────────────────────────────────────
    const {
      uploadAndExtract,
      ocrLoading,
      ocrError,
      ocrFields,
      ocrProgress,
      resetOcr,
      fieldLabel: ocrFieldLabel,
      ocrRawText,
    } = useOcr();
    // ─────────────────────────────────────────────────────────────────────

    return {
      companies,
      authZoho,
      sendEmail,
      isTokenValid,
      getTokenAgeMinutes,
      clearSession,
      saveSentEmail,
      // ── CHANGED: expose OCR refs ────────────────────────────────────────
      uploadAndExtract,
      ocrLoading,
      ocrError,
      ocrFields,
      ocrRawText,
      ocrProgress,
      resetOcr,
      ocrFieldLabel,
    };
  },

  data() {
    return {
      sending: false,
      zohoConnected: false,
      ocrDialogOpen: false,
      // ── CHANGED: replaced ocrProcessing/ocrStatus with ocrApplied ───────
      ocrApplied: new Set(),
      // ─────────────────────────────────────────────────────────────────────

      templateOptions: [
        { label: "Special Approval", value: "specialApproval" },
        { label: "Issue New Policy", value: "issueNewPolicy" },
        { label: "Change Issued Cover", value: "changeIssuedCover" },
        { label: "Policy Transfer", value: "policyTransfer" },
      ],

      governmentTypeOptions: [
        { label: "خاص — Private", value: "private" },
        { label: "حكومي — Government", value: "government" },
        { label: "تجاري — Commercial", value: "commercial" },
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
        ocrFiles: null,
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

    // ── CHANGED: OCR computed properties ───────────────────────────────────
    ocrNonNullFields() {
      if (!this.ocrFields || typeof this.ocrFields !== "object") return {};
      return Object.fromEntries(
        Object.entries(this.ocrFields).filter(([, v]) => v !== null),
      );
    },
    ocrFoundCount() {
      return Object.keys(this.ocrNonNullFields).length;
    },
    ocrStatusMessage() {
      if (this.ocrLoading) return `Scanning document… ${this.ocrProgress}%`;
      if (this.ocrError) return this.ocrError;
      if (this.ocrFields)
        return `${this.ocrFoundCount} field${this.ocrFoundCount !== 1 ? "s" : ""} extracted — click chips to apply or use "Apply all".`;
      return "Upload an image or PDF (JPG, PNG, BMP, TIFF, WebP, PDF) to auto-fill fields.";
    },
    ocrBannerClass() {
      if (this.ocrError) return "ocr-banner--error";
      if (this.ocrFields) return "ocr-banner--success";
      return "";
    },
    ocrBannerIcon() {
      if (this.ocrLoading) return "hourglass_empty";
      if (this.ocrError) return "error_outline";
      if (this.ocrFields) return "check_circle";
      return "tips_and_updates";
    },
    ocrBannerIconColor() {
      if (this.ocrError) return "negative";
      if (this.ocrFields) return "positive";
      return "teal-7";
    },
    // ─────────────────────────────────────────────────────────────────────
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
  },

  methods: {
    // ── CHANGED: OCR methods ───────────────────────────────────────────────
    async onOcrFileSelected(file) {
      if (!file) {
        this.resetOcr();
        this.ocrApplied = new Set();
        return;
      }
      this.ocrApplied = new Set();
      const result = await this.uploadAndExtract(file).catch(() => null);
      if (!result || !result.fields) return;
      // Do NOT auto-apply — show chips so user can confirm each field
      if (result.foundCount > 0) {
        this.$q.notify({
          type: "info",
          message: `${result.foundCount} field${result.foundCount !== 1 ? "s" : ""} found — review below and click to apply`,
          icon: "document_scanner",
          timeout: 4000,
        });
      } else {
        this.$q.notify({
          type: "warning",
          message:
            "OCR ran but found no recognisable fields. Try a clearer scan or higher resolution.",
          icon: "search_off",
          timeout: 5000,
        });
      }
    },

    mergeOcrFields(fields, overwriteEmpty = false) {
      const map = {
        insuredName: "customerName",
        cprNumber: "customerCPR",
        crNumber: "customerCPR",
        plateNumber: "plateNo",
        chassisNumber: "chassisNo",
        effectiveDate: "startDate",
        expiryDate: "expiryDate",
      };
      for (const [ocrKey, formKey] of Object.entries(map)) {
        if (!fields[ocrKey]) continue;
        if (overwriteEmpty && this.formInputs[formKey]) continue;
        this.formInputs[formKey] =
          formKey === "startDate" || formKey === "expiryDate"
            ? this.toInputDate(fields[ocrKey])
            : fields[ocrKey];
        this.ocrApplied = new Set([...this.ocrApplied, ocrKey]);
      }
    },

    applySingleOcrField(ocrKey, value) {
      const map = {
        insuredName: "customerName",
        cprNumber: "customerCPR",
        crNumber: "customerCPR",
        plateNumber: "plateNo",
        chassisNumber: "chassisNo",
        effectiveDate: "startDate",
        expiryDate: "expiryDate",
      };
      const formKey = map[ocrKey];
      if (formKey) {
        this.formInputs[formKey] =
          formKey === "startDate" || formKey === "expiryDate"
            ? this.toInputDate(value)
            : value;
      }
      this.ocrApplied = new Set([...this.ocrApplied, ocrKey]);
    },

    applyAllOcrFields() {
      if (!this.ocrFields) return;
      this.mergeOcrFields(this.ocrFields, false);
      this.$q.notify({
        type: "positive",
        message: "All OCR fields applied",
        icon: "auto_fix_high",
        timeout: 2000,
      });
    },

    onFieldsConfirmed(fields) {
      const map = {
        owner_name:         "customerName",
        cpr_number:         "customerCPR",
        vehicle_reg_number: "plateNo",
        chassis_number:     "chassisNo",
        policy_start_date:  "startDate",
        license_issue_date: "startDate",
        policy_end_date:    "expiryDate",
        expiry_date:        "expiryDate",
        renewal_date:       "expiryDate",
      };
      for (const [ocrKey, formKey] of Object.entries(map)) {
        if (fields[ocrKey] == null) continue;
        const isDate = formKey === "startDate" || formKey === "expiryDate";
        this.formInputs[formKey] = isDate
          ? this.toInputDate(fields[ocrKey])
          : fields[ocrKey];
      }
      // registration_type → governmentType (lowercase to match option values)
      if (fields.registration_type) {
        const t = fields.registration_type.toLowerCase();
        if (["private", "government", "commercial"].includes(t)) {
          this.formInputs.governmentType = t;
        }
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

        await this.sendEmail({
          to: this.form.to,
          cc: this.form.cc,
          subject: this.form.subject,
          content: this.form.content,
          attachments,
          attachmentMode: this.form.attachmentMode,
        });

        await this.saveSentEmail({
          to: this.form.to,
          cc: this.form.cc,
          subject: this.form.subject,
          template: this.form.template,
          companyId: this.form.company,
          companyName:
            this.companies.find((c) => c.id === this.form.company)?.name || "",
          attachmentCount: attachments.length,
        });

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

      const templateFn = emailTemplates[this.form.template];

      if (!templateFn) {
        this.form.content = `
          <div class="email-template">
            <p style="color:#dc2626;font-weight:600;">Template not found.</p>
          </div>
        `;
        return;
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
      });
    },

    openTraffic() {
      window.open("https://bahrain.bh", "_blank");
    },

    resetForm() {
      this.$q
        .dialog({
          title: "Reset form",
          message: "Are you sure you want to clear all fields?",
          cancel: true,
          persistent: true,
        })
        .onOk(() => {
          this.form = {
            company: null,
            template: null,
            subject: "",
            to: [],
            cc: [],
            attachments: null,
            attachmentMode: "merge",
            content: "",
            ocrFiles: null,
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
          };
          // ── CHANGED: reset OCR state ──────────────────────────────────
          this.resetOcr();
          this.ocrApplied = new Set();
        });
    },
  },
};
</script>

<style scoped>
/* ── PAGE ── */
.send-email-page {
  background: #eef2fb;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ── PAGE HEADER ── */
.page-header {
  background: #ffffff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);
  box-shadow: 0 1px 4px rgba(15, 31, 61, 0.06);
  flex-shrink: 0;
  padding: 0 20px;
}
.page-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
}
.page-title {
  font-size: 15px;
  font-weight: 700;
  color: #0f1f3d;
  letter-spacing: -0.2px;
}
.page-subtitle {
  font-size: 12px;
  color: #8492a6;
  margin-top: 1px;
}
.header-badges {
  display: flex;
  gap: 8px;
  align-items: center;
}
.status-chip {
  font-size: 11px !important;
  font-weight: 600 !important;
  height: 26px !important;
  border-radius: 6px !important;
}
.ready-chip {
  font-size: 11px !important;
  font-weight: 600 !important;
  height: 24px !important;
}

/* ── GRID ── */
.composer-grid {
  display: grid;
  grid-template-columns: 280px 1fr 340px;
  gap: 16px;
  flex: 1;
  height: calc(100vh - 56px);
  min-height: 0;
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
  justify-content: space-between;
  padding: 14px 16px 12px !important;
  flex-shrink: 0;
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
  padding: 14px 16px !important;
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
  letter-spacing: 0.6px;
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
  display: flex;
  padding: 12px !important;
}
.tg-editor {
  flex: 1;
  border-radius: 12px !important;
  overflow: hidden;
  border: 1.5px solid rgba(37, 99, 235, 0.12) !important;
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

.ocr-card {
  flex-shrink: 0;
}
.form-inputs-card {
  flex: 1;
  min-height: 0;
}

/* ── OCR BANNER ── */
.ocr-banner {
  background: #f0fdfa !important;
  border: 1px solid #99f6e4;
  border-radius: 10px !important;
  font-size: 12px;
}
.ocr-banner-text {
  font-size: 12px;
  color: #0f766e;
}
/* CHANGED: banner state variants */
.ocr-banner--error {
  background: #fff5f5 !important;
  border-color: #fca5a5 !important;
}
.ocr-banner--success {
  background: #f0fdf4 !important;
  border-color: #86efac !important;
}
.ocr-progress {
  margin-top: 4px;
  border-radius: 4px;
}
.ocr-upload-label {
  font-size: 12px;
}

/* CHANGED: OCR extracted field chips */
.ocr-raw-wrap {
  border: 1px solid #fed7aa;
  border-radius: 8px;
  padding: 8px 10px;
  background: #fff7ed;
}
.ocr-raw-label {
  font-size: 10px;
  font-weight: 700;
  color: #92400e;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 4px;
}
.ocr-raw-text {
  font-size: 11px;
  color: #374151;
  white-space: pre-wrap;
  max-height: 120px;
  overflow-y: auto;
  line-height: 1.5;
}

.ocr-fields-wrap {
  border: 1px solid #d1fae5;
  border-radius: 10px;
  padding: 10px;
  background: #f0fdf4;
}
.ocr-fields-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.ocr-fields-title {
  font-size: 11px;
  font-weight: 700;
  color: #065f46;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.ocr-chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.ocr-chip {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 5px 22px 5px 8px;
  border: 1px solid #a7f3d0;
  border-radius: 8px;
  cursor: pointer;
  background: #ffffff;
  transition:
    border-color 0.15s,
    background 0.15s;
  min-width: 90px;
  max-width: 160px;
}
.ocr-chip:hover {
  border-color: #10b981;
  background: #ecfdf5;
}
.ocr-chip--applied {
  border-color: #10b981 !important;
  background: #d1fae5 !important;
}
.ocr-chip__label {
  font-size: 9px;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 1px;
}
.ocr-chip__value {
  font-size: 11px;
  color: #111827;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ocr-chip__icon {
  position: absolute;
  top: 5px;
  right: 5px;
  color: #9ca3af;
}
.ocr-chip--applied .ocr-chip__icon {
  color: #10b981;
}

/* ── FORM INPUTS ── */
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
