# Regras de segurança do Firebase

Esta regra deixa qualquer pessoa **ver** o site (fotos, álbuns, eventos e equipe). Só o administrador pode **salvar**, e só ele pode **ver** as turmas, os alunos e as mensalidades.

Na regra abaixo, troque `SEU-EMAIL@gmail.com` pelo e-mail do administrador que você cadastrou em Authentication. Escreva o e-mail exatamente igual, em letras minúsculas.

## 1. Firestore

No Firebase, abra **Firestore Database > Regras**, apague tudo o que estiver lá, cole o texto abaixo e clique em **Publicar**.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null && request.auth.token.email == 'SEU-EMAIL@gmail.com';
    }
    match /site/{doc} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /private/{doc} {
      allow read, write: if isAdmin();
    }
  }
}
```

## 2. Bloquear cadastro de outras pessoas

Em **Authentication > Configurações > Ações do usuário**, desmarque **Ativar criação (inscrição)** e salve. Assim ninguém consegue criar uma conta sozinho. Novos administradores só entram se você cadastrar em Authentication > Usuários (e incluir o e-mail deles nas regras).

## Fotos e vídeos

As fotos e vídeos não ficam no Firebase: ficam no Cloudinary (plano gratuito). Configure em `js/firebase-config.js`, no bloco `CLOUDINARY_CONFIG`, com o seu Cloud name e o nome do Upload preset (tipo Unsigned).
