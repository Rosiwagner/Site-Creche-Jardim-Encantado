# Site Jardim Encantado (versão 2, com Firebase)

Site da Creche-Escola e Hotel Infantil Jardim Encantado, feito só com HTML, CSS e JavaScript.

## Como abrir

Abra o arquivo `index.html` no navegador (Chrome, Edge ou Firefox). Para publicar na internet, envie a pasta inteira para qualquer hospedagem de site estático (por exemplo Netlify, GitHub Pages ou a hospedagem que você já usa).

## Entrar como administrador

Clique no botão **Administrador**, no topo, e entre com o **e-mail e a senha** que você cadastrou no Firebase, em Authentication > Usuários. Se esquecer a senha, use "Esqueci a senha" na tela de login.

## O que o administrador pode fazer

| Aba | O que faz |
|---|---|
| Carrossel | Adicionar até 30 fotos, trocar, excluir, mudar a ordem e colocar legenda |
| Álbuns | Criar, editar e excluir álbuns. Adicionar e excluir fotos e vídeos, escolher a capa |
| Agenda | Cadastrar, editar e excluir eventos (formatura, Natal, Dia das Mães, Dia dos Pais, Dia das Crianças...) e ligar um álbum ao evento |
| Funcionários | Cadastrar foto, nome e função. Editar, excluir e mudar a ordem |
| Turmas | Cadastrar as turmas (Baby Class, Maternal, Jardim...) |
| Alunos e mensalidades | Ficha completa do aluno, pesquisa por nome e controle das mensalidades pagas, pendentes e atrasadas. Só aparece no painel |

## Onde ficam os dados

Tudo fica salvo no Firebase (projeto `jardim-encantado-ab7ca`):
- Firestore: textos e listas. `site/...` é público, `private/...` (turmas e alunos) só o administrador lê.
- Storage: fotos e vídeos (pasta `media/`), até 100 MB por vídeo.

Enquanto o administrador não salvar nada, o site mostra o conteúdo inicial (panfletos e vídeos da pasta `img/` e `videos/`).

Antes de usar, configure as regras de segurança: veja **REGRAS-FIREBASE.md**.

## Arquivos

- `index.html`: a página
- `css/style.css`: cores e visual
- `js/firebase-config.js`: qual projeto do Firebase o site usa
- `js/db.js`: leitura e gravação no Firebase
- `js/vendor/`: bibliotecas do Firebase (versão 10.12.2)
- `js/site.js`: parte pública (carrossel, galeria, agenda, equipe, pacotes)
- `js/admin.js`: painel do administrador
- `img/` e `videos/`: panfletos e vídeos de divulgação
