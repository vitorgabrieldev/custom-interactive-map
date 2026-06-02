# BACKLOG — Custom Interactive Map

> Projeto: Mapa interativo apocalipse zumbi (GTA5 aesthetic)
> Stack: React + TypeScript + Vite + MapLibre GL JS + Supabase + Liveblocks

---

## INTERAÇÃO USUÁRIO → MAPA

### Exploração
- [ ] **#01 — Névoa de guerra** — mapa começa coberto; cada player ilumina a área ao redor do cursor em tempo real; regiões nunca visitadas ficam escuras
- [ ] **#02 — Memória coletiva** — áreas visitadas por 1 player ficam levemente iluminadas; totalmente reveladas só quando X players diferentes passaram por lá
- [ ] **#03 — Marcadores temporários de aviso** — player solta um pin rápido (ex: "HORDA AQUI") que pisca e some em 10 minutos
- [ ] **#04 — Zona contaminada dinâmica** — região do mapa fica vermelha pulsando e vai expandindo; para de crescer se players ativarem postos de contenção ao redor

### Territórios
- [ ] **#05 — Reivindicar território** — player segura clique numa área por 3s e ela fica com a cor do seu time/facção
- [ ] **#06 — Decaimento de território** — zonas sem atividade por 24h murcham de cor e voltam a ser neutras
- [ ] **#07 — Capital de facção** — facção que controla o marcador central do mapa ganha status visível no topo da sidebar
- [ ] **#08 — Corredor seguro** — player pinta uma rota entre dois pontos; aparece como linha tracejada pra todos por 30 min

### Construção / Sobrevivência
- [ ] **#09 — Plantar base** — player escolhe ponto vazio e constrói uma base com nome, ícone e cor de facção
- [ ] **#10 — Upgrade de base** — outros contribuem com recursos clicando na base; ao atingir X contribuições o ícone evolui visualmente
- [ ] **#11 — Emboscada** — player oculta marcador de perigo numa rota; invisível pra quem não é do grupo; outros "caem" e recebem notificação
- [ ] **#12 — Ruínas** — base abandonada por muito tempo vira marcador de ruína com loot disponível pra qualquer um coletar

---

## INTERAÇÃO USUÁRIO → USUÁRIO

### Comunicação
- [ ] **#13 — Rádio de emergência** — player manda mensagem curta (máx 60 chars) que aparece como onda de rádio se expandindo no mapa a partir da posição dele
- [ ] **#14 — Sinal de socorro** — botão SOS que manda ping pulsante visível pra todos; quem "responder" fica vinculado como aliado temporário
- [ ] **#15 — Dead drop** — player deixa mensagem secreta num ponto do mapa; só aparece pra quem clicar exatamente naquele ponto
- [ ] **#16 — Graffiti** — player escreve mensagem curta numa área; fica como texto flutuante por 1h; outros podem curtir pra aumentar o tempo de vida

### Cooperação
- [ ] **#17 — Missão conjunta** — player cria objetivo com recompensa em reputação; outros aceitam e aparecem como aliados no mapa
- [ ] **#18 — Comboio** — player inicia comboio; outros entram; aparece no mapa como grupo de ícones se movendo juntos
- [ ] **#19 — Sinal de reconhecimento** — player clica no avatar de outro na lista de online e manda flash que aparece no cursor do outro
- [ ] **#20 — Posto de trocas** — player marca local de encontro para troca; aparece no mapa por 30 min com nome do player

### Conflito
- [ ] **#21 — Zona disputada** — duas facções brigam por ponto estratégico; cada clique conta como influência; mais cliques em 5 min captura
- [ ] **#22 — Sabotagem** — player de facção inimiga pode enfraquecer base adversária com 3 cliques seguidos; terceiro clique reduz nível
- [ ] **#23 — Espião** — player entra "de incógnito": nome aparece como "Desconhecido" pra outros, mas posição vaza pra quem tem perk de detecção
- [ ] **#24 — Recompensa** — player marca outro como "procurado"; ícone de caveira aparece perto do cursor do alvo no mapa

---

## PROGRESSÃO

- [ ] **#25 — Rank de sobrevivente** — cada ação gera XP; sidebar mostra rank (Recruta → Veterano → Lenda)
- [ ] **#26 — Título conquistado** — milestones dão títulos que aparecem antes do nome: [EXPLORADOR], [CONSTRUTOR], [CAÇADOR]
- [ ] **#27 — Streak de presença** — cada dia acessado acumula contador visível; maior streak aparece primeiro na lista de online
- [ ] **#28 — Legado** — player offline por 7+ dias tem base ficando cinza com plaquinha "Memória de [nome]"; outros podem prestar homenagem

---

## EVENTOS DINÂMICOS

- [ ] **#29 — Evento de horda** — horda lançada pelo sistema se move pelo mapa; players precisam ativar N barricadas antes que ela chegue ao centro
- [ ] **#30 — Tempestade de radiação** — área grande do mapa em alerta laranja por 30 min; bases dentro perdem um nível
- [ ] **#31 — Loot raro** — marcador dourado piscando aparece em localização aleatória; primeiro player a clicar reivindica
- [ ] **#32 — Sinal misterioso** — marcador de rádio com coordenadas encriptadas aparece; players precisam colaborar pra decifrar (mini-puzzle)
- [ ] **#33 — Zona de quarentena** — área bloqueada visualmente por alguns minutos; ninguém vê o que tem lá dentro

---

## METAGAME

- [ ] **#34 — Diário de campo** — feed pessoal de ações: "Você explorou o setor C7", "Sua base foi atacada", "VITORGABRIEL passou pela sua rota"
- [ ] **#35 — Mapa do caos** — indicador global 0–100% do "nível de infecção" da cidade; sobe com conflitos/inatividade, cai com cooperação
- [ ] **#36 — Aliança registrada** — dois players formalizam aliança; ficam com mesma cor de presença e veem posição um do outro
- [ ] **#37 — Armistício** — se duas facções estão em conflito há X horas, botão de negociação aparece; ambos líderes precisam aceitar pra resetar hostilidades
- [ ] **#38 — Placar de facções** — ranking semanal na sidebar: territórios controlados, missões completadas, players ativos, bases construídas

---

## ECONOMIA — ESPECIFICAÇÃO

> Moeda: **RAD**
> Filosofia: entre EVE Online e risco real — sem login não ganha, sumiço prolongado vira ruína e dá pra te roubar.

---

### Como GANHAR RAD
| Ação | Ganho |
|---|---|
| Explorar um PIN novo (primeira vez) | +15 RAD |
| Completar missão | +40–80 RAD |
| Coletar loot raro (spawna no mapa) | +25–60 RAD |
| Streak diário (basta logar) | +5 RAD/dia |

### Como GASTAR RAD
| Ação | Custo |
|---|---|
| Plantar base | 50 RAD |
| Manutenção de base (custo diário automático) | 10 RAD/dia |
| Soltar rádio de emergência | 2 RAD |
| Reivindicar território | 20 RAD |
| Slot extra no inventário | 30 RAD |

---

### INVENTÁRIO
- **Slots iniciais:** 6
- **Expansão:** +1 slot por 30 RAD (sem limite definido ainda)
- **Métrica de item:** Nível de Utilidade (em vez de "peso")

**Categorias de item:**
| Tipo | Exemplos | Uso |
|---|---|---|
| `SUPRIMENTO` | Ração, Água, Medicamento | Curar base, trocar com players |
| `FERRAMENTA` | Rádio, Binóculo, Detector | Ativam mecânicas do mapa |
| `ARMA` | Faca, Pistola, Molotov | Conflitos e sabotagens |
| `BLUEPRINT` | Esquemas de construção | Necessários pra upgrades de base |
| `CHAVE` | Chave de quarentena, Chave de dead drop | Abre zonas/drops específicos |

**Raridade de itens:**
- `NORMAL` — comum, drop frequente
- `INCOMUM` — drop moderado
- `RARO` — drop baixo, estatísticas melhores
- `LENDÁRIO` — drop muito baixo, efeito especial
- `ÚNICO` — 1 exemplar no servidor, instransferível (ou quase)
- `ARTEFATO` — drop de eventos especiais, mecânica própria

**De onde vêm:**
- **Loot raro (#31)** — spawna aleatório no mapa, qualquer raridade
- **Ruínas (#12)** — itens deixados em bases de players sumidos (3+ dias sem login)
- **Zona de quarentena (#33)** — itens exclusivos, raridade maior
- **Crafting** — 2 itens do mesmo tipo + mesma utilidade → 1 item do mesmo tipo com utilidade maior

---

### RISCO E DECAIMENTO

**Base:**
- Sem login por **3 dias** → base entra em estado de **RUÍNA**
- Ruína fica visível no mapa pra todos com ícone distinto
- Qualquer player pode saquear os itens armazenados na base
- RAD do dono continua drenando 10/dia até zerar (base não é deletada, só fica vazia e cinza)
- Após **7 dias** de ruína sem interação → base é removida do mapa completamente

**Dois inventários separados:**
- **Inventário pessoal** — anda com o player, 6 slots, não tem como saquear, sem sistema de peso
- **Stash da base** — fica dentro da base, é o alvo de raids; slots a definir (expansível futuramente)

**Roubo (Raid):**
- Player visita base alheia e inicia **RAID**
- Raid tem duração de **5 horas** após iniciado
- Durante as 5h, o dono recebe notificação e pode entrar no jogo pra cancelar/defender
- Se o dono não aparecer em 5h → raid conclui, ladrão pega itens do stash da base
- Se base já for ruína: sem resistência, loot direto (sem timer)

**RAD:**
- Sem saldo → base para de funcionar (entra em ruína antes dos 3 dias)
- Não há como roubar RAD diretamente — só itens do stash

**Crafting:**
- 2 itens do **mesmo tipo** + **mesma utilidade** são consumidos
- Resultado: 1 item do mesmo tipo com utilidade/raridade maior
- Ambos os itens somem permanentemente — saem de circulação (deflacionário)

---

### TASKS DE IMPLEMENTAÇÃO

- [ ] **#39 — Schema Supabase: tabela `wallets`** — saldo RAD por player, histórico de transações
- [ ] **#40 — Schema Supabase: tabela `items`** — catálogo de itens com tipo, raridade, nível de utilidade
- [ ] **#41 — Schema Supabase: tabela `inventories`** — itens no inventário de cada player (FK player + item)
- [ ] **#42 — Schema Supabase: tabela `bases`** — bases plantadas, nível, estado (ativa/ruína/destruída), dono
- [ ] **#43 — Schema Supabase: tabela `base_items`** — itens guardados dentro de bases (separado do inventário pessoal)
- [ ] **#44 — Cron de manutenção diária** — drena 10 RAD/dia de cada base ativa; marca ruína em bases sem saldo
- [ ] **#45 — Cron de streak** — credita +5 RAD/dia pra quem logou nas últimas 24h
- [ ] **#46 — Sistema de loot spawn** — job que spawna marcadores de loot em posições aleatórias no mapa
- [ ] **#47 — Crafting engine** — regras de combinação: mesmo tipo + mesma utilidade → utilidade +1
- [ ] **#48 — Raid mechanic** — lógica de raid com timer, notificação em tempo real via Liveblocks, resolução
- [ ] **#49 — UI: Inventário na sidebar** — visualização dos 6 slots, raridade com cor, ações (usar, jogar fora, guardar na base)
- [ ] **#50 — UI: Wallet** — RAD balance visível no header da sidebar, histórico de transações
