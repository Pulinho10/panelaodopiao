# Panelão Brasileiro de Beyblade X 2026 — Registro de Partidas

Aplicação web estática para cadastro e homologação de partidas do torneio.

## Recursos
- Cadastro de jogadores com PIN de validação (armazenado como hash SHA-256 no navegador).
- Cadastro de juízes.
- Registro de fase, rodada, mesa/arena, juiz e até 3 combos por jogador.
- Registro de cada batalha com vencedor e tipo de pontuação: Spin Finish (1), Over Finish (2), Burst Finish (2) ou Extreme Finish (3).
- Placar total calculado automaticamente a partir dos resultados registrados pelo juiz.
- Suporte a Lock Chip, Blade, Over Blade, Metal Blade, Assist Blade, Ratchet e Bit, com digitação livre.
- Validação independente de Jogador A e Jogador B.
- Partida considerada homologada apenas após as duas validações.
- Histórico pesquisável e filtro por status.
- Classificação calculada apenas com partidas homologadas.
- Backup JSON, importação JSON e exportação CSV.
- PWA/offline quando publicada via HTTPS (ex.: GitHub Pages).

## Uso local
Abra `index.html` em um navegador moderno. Para PWA/service worker, use um servidor HTTP local.

Exemplo com Python:

```bash
python -m http.server 8080
```

Depois acesse `http://localhost:8080`.

## Publicação no GitHub Pages
Envie estes arquivos para a raiz de um repositório e habilite **Settings → Pages → Deploy from a branch**.

## Armazenamento
Os dados ficam em `localStorage` do navegador/dispositivo. Faça backups JSON periódicos durante o evento.

- Registro da pontuação por botões interativos: Spin Finish (+1), Over Finish (+2), Burst Finish (+2) e Extreme Finish (+3).

## Confronto de combos por batalha

Antes de registrar qualquer Spin Finish, Over Finish, Burst Finish ou Extreme Finish, o juiz deve selecionar o combo utilizado por cada jogador naquela batalha. O lançamento fica vinculado aos dois combos e o histórico passa a exibir o confronto específico. Os botões de pontuação ficam visualmente indisponíveis enquanto os dois combos não forem selecionados.

## Atualização — seleção de combos por batalha
- Cada jogador pode ter até 3 combos pré-registrados em **Jogadores e juízes > Gerenciar combos**.
- Ao selecionar Jogador A e Jogador B em uma nova partida, seus combos cadastrados são carregados automaticamente.
- Em cada batalha, o juiz usa os botões **Selecionar combo do Jogador A** e **Selecionar combo do Jogador B**.
- A pontuação (Spin/Over/Burst/Extreme) só pode ser lançada depois que os dois combos forem escolhidos.
- O confronto de combos fica armazenado junto ao resultado da batalha.
