import { ref } from "vue";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "src/firebase/config";

const companies = ref([]);
let unsubscribe = null;

function startListening() {
  if (unsubscribe) return; // already listening

  const companiesRef = collection(db, "companies");

  unsubscribe = onSnapshot(companiesRef, (snapshot) => {
    companies.value = snapshot.docs.map((d) => ({
      id:   d.id,
      name: d.data().name ?? "",
      to:   d.data().to   ?? [],
      cc:   d.data().cc   ?? [],
    }));
  });
}

export function useCompanies() {
  startListening();

  async function addCompany(data) {
    await addDoc(collection(db, "companies"), {
      name: data.name,
      to:   data.to   ?? [],
      cc:   data.cc   ?? [],
    });
  }

  async function updateCompany(id, data) {
    await updateDoc(doc(db, "companies", id), {
      name: data.name,
      to:   data.to   ?? [],
      cc:   data.cc   ?? [],
    });
  }

  async function removeCompany(id) {
    await deleteDoc(doc(db, "companies", id));
  }

  return {
    companies,
    addCompany,
    updateCompany,
    removeCompany,
  };
}