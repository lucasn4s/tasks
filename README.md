# Afazeres do dia

Extensão do Chrome para controlar as tarefas do dia de trabalho. As tarefas podem ser criadas digitando o texto ou apontando um elemento de qualquer página — o texto do elemento vira a tarefa.

## Funcionalidades

- **Adicionar por texto** no popup da extensão.
- **Adicionar a partir de um elemento da página**: destaca o elemento sob o mouse, `↑`/`↓` sobe/desce para o elemento pai/filho e, ao clicar, abre um editor para ajustar o texto antes de criar a tarefa. A tarefa guarda o link da página de origem.
- **Menu de contexto**: "Adicionar … aos afazeres" com um texto selecionado.
- **Reordenar arrastando** pela alça à esquerda de cada tarefa.
- Concluir, editar (duplo clique) e excluir tarefas; barra de progresso do dia e contador de pendentes no ícone.
- Tarefas concluídas em dias anteriores são limpas automaticamente; as pendentes continuam.

### Atalhos

| Atalho | Ação |
| --- | --- |
| `Alt+Shift+T` | Abrir a lista |
| `Alt+Shift+E` | Selecionar um elemento da página |

Podem ser alterados em `chrome://extensions/shortcuts`.

## Instalação

1. Clone o repositório (ou baixe o zip e extraia numa pasta fixa).
2. Abra `chrome://extensions` e ligue o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e escolha a pasta do projeto.

## Privacidade

As tarefas ficam apenas no `chrome.storage.local` do navegador; nada é enviado para fora. A extensão só acessa a aba atual quando você aciona o seletor de elementos (permissão `activeTab`).
