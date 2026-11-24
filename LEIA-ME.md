# Site Jardim Encantado (versão 1)

Site da Creche-Escola e Hotel Infantil Jardim Encantado, feito só com HTML, CSS e JavaScript.

## Como abrir

Abra o arquivo `index.html` no navegador (Chrome, Edge ou Firefox). Para publicar na internet, envie a pasta inteira para qualquer hospedagem de site estático (por exemplo Netlify, GitHub Pages ou a hospedagem que você já usa).

## Entrar como administrador

Clique no botão **Administrador**, no canto de cima.

- Usuário: `admin`
- Senha inicial: `jardim2027`

Troque a senha logo no primeiro acesso, na aba **Configurações** do painel.

## O que o administrador pode fazer

| Aba | O que faz |
|---|---|
| Carrossel | Adicionar até 30 fotos, trocar, excluir, mudar a ordem e colocar legenda |
| Álbuns | Criar, editar e excluir álbuns. Adicionar e excluir fotos e vídeos, escolher a capa |
| Agenda | Cadastrar, editar e excluir eventos (formatura, Natal, Dia das Mães, Dia dos Pais, Dia das Crianças...) e ligar um álbum ao evento |
| Funcionários | Cadastrar foto, nome e função. Editar, excluir e mudar a ordem |
| Turmas | Cadastrar as turmas (Baby Class, Maternal, Jardim...) |
| Alunos e mensalidades | Ficha completa do aluno, pesquisa por nome e controle das mensalidades pagas, pendentes e atrasadas. Só aparece no painel |

## Importante sobre esta versão

Ainda não existe um servidor. Tudo o que o administrador cadastra fica guardado **somente no navegador do computador onde foi cadastrado**. Quem visita o site de outro aparelho vê só o conteúdo inicial (os panfletos e vídeos). O login também é só uma demonstração: não protege dados de verdade.

Por isso, ainda não cadastre os dados reais dos alunos. Use para testar e aprovar o visual e o funcionamento.

**Próximo passo sugerido (versão 2):** ligar o site ao Firebase (ou outro serviço) para salvar tudo na internet, com login seguro do administrador e os dados dos alunos protegidos.

## Arquivos

- `index.html`: a página
- `css/style.css`: cores e visual
- `js/db.js`: onde os dados são salvos (é este arquivo que muda na versão com servidor)
- `js/site.js`: parte pública (carrossel, galeria, agenda, equipe, pacotes)
- `js/admin.js`: painel do administrador
- `img/` e `videos/`: panfletos e vídeos de divulgação
