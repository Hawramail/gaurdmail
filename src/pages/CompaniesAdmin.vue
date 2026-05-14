<template>
  <q-page class="q-pa-lg">
    <div class="row items-center justify-between q-mb-lg">
      <div>
        <div class="text-h6 text-weight-medium">Insurance Companies</div>
        <div class="text-caption text-grey-6">
          Manage TO and CC recipients per company
        </div>
      </div>
      <q-btn
        unelevated
        color="primary"
        label="Add company"
        icon="add"
        no-caps
        @click="openAdd"
      />
    </div>

    <q-card flat bordered>
      <q-table
        :rows="companies"
        :columns="columns"
        row-key="id"
        flat
        :pagination="{ rowsPerPage: 10 }"
        no-data-label="No companies yet. Add one above."
      >
        <template #body-cell-to="props">
          <q-td :props="props">
            <q-chip
              v-for="email in props.row.to"
              :key="email"
              dense
              color="blue-1"
              text-color="blue-8"
              size="sm"
              class="q-mr-xs"
            >
              {{ email }}
            </q-chip>
            <span v-if="!props.row.to.length" class="text-grey-5 text-caption">—</span>
          </q-td>
        </template>

        <template #body-cell-cc="props">
          <q-td :props="props">
            <q-chip
              v-for="email in props.row.cc"
              :key="email"
              dense
              color="green-1"
              text-color="green-8"
              size="sm"
              class="q-mr-xs"
            >
              {{ email }}
            </q-chip>
            <span v-if="!props.row.cc.length" class="text-grey-5 text-caption">—</span>
          </q-td>
        </template>

        <template #body-cell-actions="props">
          <q-td :props="props">
            <q-btn
              flat dense size="sm" icon="edit" color="primary"
              @click="openEdit(props.row)"
            />
            <q-btn
              flat dense size="sm" icon="delete" color="negative"
              @click="deleteCompany(props.row.id)"
              class="q-ml-xs"
            />
          </q-td>
        </template>
      </q-table>
    </q-card>

    <!-- Add / Edit Dialog -->
    <q-dialog v-model="dialog" persistent>
      <q-card style="min-width: 480px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-subtitle1 text-weight-medium">
            {{ editingId ? "Edit company" : "Add company" }}
          </div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section class="q-gutter-md">
          <q-input
            v-model="form.name"
            label="Company name"
            outlined
            dense
            placeholder="e.g. GIG Gulf"
          />

          <!-- TO field -->
          <div>
            <div class="text-caption text-weight-medium text-grey-7 q-mb-xs">
              TO email addresses
            </div>
            <div class="row wrap q-gutter-xs q-mb-xs">
              <q-chip
                v-for="(email, i) in form.to"
                :key="i"
                removable
                dense
                color="blue-1"
                text-color="blue-8"
                size="sm"
                @remove="form.to.splice(i, 1)"
              >
                {{ email }}
              </q-chip>
            </div>
            <q-input
              v-model="toInput"
              outlined
              dense
              placeholder="Type email and press Enter"
              @keydown.enter.prevent="addEmail('to')"
            />
          </div>

          <!-- CC field -->
          <div>
            <div class="text-caption text-weight-medium text-grey-7 q-mb-xs">
              CC email addresses
            </div>
            <div class="row wrap q-gutter-xs q-mb-xs">
              <q-chip
                v-for="(email, i) in form.cc"
                :key="i"
                removable
                dense
                color="green-1"
                text-color="green-8"
                size="sm"
                @remove="form.cc.splice(i, 1)"
              >
                {{ email }}
              </q-chip>
            </div>
            <q-input
              v-model="ccInput"
              outlined
              dense
              placeholder="Type email and press Enter"
              @keydown.enter.prevent="addEmail('cc')"
            />
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat label="Cancel" no-caps v-close-popup />
          <q-btn
            unelevated
            color="primary"
            label="Save company"
            no-caps
            @click="saveCompany"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script>
import { useCompanies } from "src/composables/useCompanies";

export default {
  name: "CompaniesAdmin",

  setup() {
    const { companies, addCompany, updateCompany, removeCompany } =
      useCompanies();
    return { companies, addCompany, updateCompany, removeCompany };
  },

  data() {
    return {
      dialog: false,
      editingId: null,
      toInput: "",
      ccInput: "",
      form: { name: "", to: [], cc: [] },
      columns: [
        { name: "name", label: "Company", field: "name", align: "left", sortable: true },
        { name: "to", label: "TO recipients", field: "to", align: "left" },
        { name: "cc", label: "CC recipients", field: "cc", align: "left" },
        { name: "actions", label: "", field: "actions", align: "right" },
      ],
    };
  },

  methods: {
    openAdd() {
      this.editingId = null;
      this.form = { name: "", to: [], cc: [] };
      this.toInput = "";
      this.ccInput = "";
      this.dialog = true;
    },

    openEdit(row) {
      this.editingId = row.id;
      this.form = { name: row.name, to: [...row.to], cc: [...row.cc] };
      this.toInput = "";
      this.ccInput = "";
      this.dialog = true;
    },

    addEmail(field) {
      const val = field === "to" ? this.toInput.trim() : this.ccInput.trim();
      if (!val) return;
      if (!this.form[field].includes(val)) {
        this.form[field].push(val);
      }
      if (field === "to") this.toInput = "";
      else this.ccInput = "";
    },

    async saveCompany() {
      // Flush any unconfirmed typed email
      this.addEmail("to");
      this.addEmail("cc");

      if (!this.form.name.trim()) {
        this.$q.notify({ type: "warning", message: "Company name is required" });
        return;
      }
      try {
        const action = this.editingId ? "updated" : "added";
        if (this.editingId) {
          await this.updateCompany(this.editingId, { ...this.form });
        } else {
          await this.addCompany({ ...this.form });
        }
        this.dialog = false;
        this.$q.notify({ type: "positive", message: "Company saved", icon: "check" });
      } catch (err) {
        this.$q.notify({ type: "negative", message: "Failed to save: " + err.message });
      }
    },

    async deleteCompany(id) {
      const confirmed = window.confirm(
        "Are you sure? This will remove the email config for this company."
      );
      if (!confirmed) return;
      try {
        await this.removeCompany(id);
        this.$q.notify({ type: "negative", message: "Company deleted", icon: "delete" });
      } catch (err) {
        this.$q.notify({ type: "negative", message: "Failed to delete: " + err.message });
      }
    },
  },
};
</script>