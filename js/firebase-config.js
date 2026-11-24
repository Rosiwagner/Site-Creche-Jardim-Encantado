/* Configuração do projeto Firebase da Jardim Encantado.
   Estes dados não são senha: eles só dizem ao site qual projeto usar.
   Quem protege os dados são as regras de segurança do Firebase (veja REGRAS-FIREBASE.md). */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCgcvXqPeQB1L0Mp_SPVb4U20Iu6frAC8I",
  authDomain: "jardim-encantado-ab7ca.firebaseapp.com",
  projectId: "jardim-encantado-ab7ca",
  storageBucket: "jardim-encantado-ab7ca.firebasestorage.app",
  messagingSenderId: "243738228552",
  appId: "1:243738228552:web:771fba47dbc324cf33257d"
};

/* Cloudinary: onde ficam as fotos e vídeos (plano gratuito, sem cartão).
   cloudName: aparece no painel do Cloudinary (Dashboard).
   uploadPreset: nome do "Upload preset" do tipo Unsigned criado em Settings > Upload. */
window.CLOUDINARY_CONFIG = {
  cloudName: "cm7kla3e",
  uploadPreset: "ml_default",
  folder: "jardim-encantado"
};
