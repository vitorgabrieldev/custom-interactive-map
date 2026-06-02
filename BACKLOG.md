# BACKLOG — Custom Interactive Map

> Projeto: Mapa interativo apocalipse zumbi (GTA5 aesthetic)
> Stack: React + TypeScript + Vite + MapLibre GL JS + Supabase + Liveblocks

---

## ✅ IMPLEMENTADO (histórico desta sessão)

- [x] Polling de raids a cada 15s
- [x] Bug do botão Defender (RLS UPDATE sem `with check`)
- [x] Cooldown de 12h entre raids
- [x] Comprar slots de stash (20 RAD/slot, máx 50)
- [x] Custo plantar base: 250 RAD
- [x] Grid do stash: 4 colunas, botão comprar inline
- [x] Fix `null value in column "type_id"` (faltava tipo `COMPRAR_SLOT_STASH`)
- [x] Slots vazios mais visíveis (border #3a3a3a)
- [x] BaseView: stash + inventário + info + raids em painel único
- [x] Duração do raid: 5h → 1h
- [x] BasePanel simplificado: só "VISUALIZAR BASE" + "INVADIR"

## 🔴 BUG PENDENTE

- [ ] `collectLoot` falso-positivo quando Supabase retorna 0 rows sem erro (`game.ts:198`)
- [ ] `supabase db push` para aplicar migrations 16 (tipo tx stash) e 17 (raid 1h)

---

## 🏗️ FEATURE: Sistema de Evolução de Base (Níveis 1–50)

**Status:** ⏳ Em alinhamento — aguardando respostas do questionário  
**Prioridade:** Alta  

### Visão geral

O jogador gasta RAD para evoluir sua base de nível 1 até 50.  
Cada nível desbloqueia melhorias automáticas em 5 pilares:

1. **Custo de upgrade** — RAD necessário para subir ao próximo nível
2. **Proteção** — % de chance do raid falhar antes de começar
3. **Durabilidade** — quantos dias antes de virar ruína
4. **Duração do raid** — quanto tempo a invasão demora (raider espera mais)
5. **Propriedade** — raio territorial ao redor da base (com cobrança de "aluguel")

### Sub-tarefas

- [ ] **DB-01** — Tabela `base_level_config` (50 linhas, uma por nível)
- [ ] **DB-02** — RPC `upgrade_base(p_base_id, p_player_id)` — valida, debita RAD, incrementa level
- [ ] **DB-03** — Trigger de proteção em INSERT de raids — rola dado vs % de proteção
- [ ] **DB-04** — Ajuste em `start_raid` para usar duração dinâmica baseada no `level` da base
- [ ] **DB-05** — Ajuste em `cron_ruin_inactive_bases` para usar tempo de ruína do nível
- [ ] **DB-06** — Constraint/trigger ao plantar base — bloqueia se dentro de zona de propriedade alheia
- [ ] **DB-07** — Cron de cobrança de propriedade: 50 RAD/24h de bases invadindo zona alheia
- [ ] **DB-08** — Flag `items_suspended` na base quando dono não tem RAD para pagar aluguel
- [ ] **FE-01** — Seção "EVOLUIR BASE" no BaseView (custo próximo nível, barra de progresso, botão)
- [ ] **FE-02** — Cor dinâmica da base no mapa (MapLibre marker) baseada no nível
- [ ] **FE-03** — Círculo de propriedade visível no mapa ao redor de cada base
- [ ] **FE-04** — Indicador no BaseView "BASE EM ZONA ALHEIA — pagando X RAD/dia"
- [ ] **FE-05** — Toast quando raid falha por proteção: "Raid bloqueado pelo nível da base!"
- [ ] **FE-06** — Indicador de base suspensa (itens bloqueados)

### Tabela de níveis — RASCUNHO

> ⚠️ Valores ESTIMADOS. Serão ajustados após respostas do questionário.

| Nível | Custo Upgrade | Proteção | Duração Raid | Tempo Ruína | Raio Prop. | Cor |
|-------|--------------|----------|--------------|-------------|------------|-----|
| 1     | —            | 0%       | 1h           | 3d          | 50m        | #6b7280 cinza |
| 2     | 500          | 1%       | 1h10m        | 3,2d        | 65m        | #9ca3af cinza claro |
| 3     | 800          | 2%       | 1h20m        | 3,4d        | 80m        | #d1d5db quase branco |
| 5     | 2.000        | 5%       | 1h40m        | 3,8d        | 110m       | #fbbf24 amarelo |
| 8     | 5.000        | 9%       | 2h10m        | 4,2d        | 160m       | #f59e0b âmbar |
| 10    | 8.000        | 12%      | 3h           | 5d          | 200m       | #f97316 laranja |
| 15    | 20.000       | 20%      | 4h           | 6d          | 330m       | #ea580c laranja escuro |
| 20    | 45.000       | 28%      | 5h           | 7d          | 480m       | #ef4444 vermelho |
| 25    | 90.000       | 36%      | 6h30m        | 9d          | 650m       | #dc2626 vermelho escuro |
| 30    | 180.000      | 44%      | 8h           | 11d         | 850m       | #ec4899 rosa |
| 35    | 350.000      | 52%      | 9h           | 14d         | 1050m      | #d946ef rosa fúcsia |
| 40    | 650.000      | 60%      | 10h          | 17d         | 1300m      | #a855f7 roxo |
| 45    | 1.200.000    | 70%      | 11h          | 21d         | 1600m      | #7c3aed roxo escuro |
| 50    | 2.000.000    | 80%      | 12h          | 30d         | 2000m      | #4c1d95 roxo profundo |

### Questões em aberto

Ver seção `## ❓ QUESTIONÁRIO` no final deste arquivo.

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

---

## ❓ QUESTIONÁRIO — Sistema de Evolução de Base

*(Respostas a preencher conforme alinhamento com o usuário)*

### Grupo 1: Custo e Progressão

**Q1 — Curva de custo**
Os valores que você deu (500, 800, 1k, 2k, 3k, 4k, 5k, 20k...) são os primeiros níveis.
Qual é a lógica da curva até o 50? Algo como:
- (A) Exponencial suave — cada nível custa ~1,5–2x o anterior
- (B) Escada com patamares — barato por uns 5 níveis, depois salta, etc.
- (C) Você tem os 50 valores exatos na cabeça — me passa que eu coloco
- (D) Me deixa montar a curva e você aprova

**Q1 resposta:** _________

**Q2 — Upgrade é instantâneo?**
Ao clicar "Evoluir", a base sobe de nível na hora, ou tem que esperar um timer (ex: 30 min para construção)?

**Q2 resposta:** _________

**Q3 — Contribuição coletiva?**
Outros jogadores podem contribuir RAD para o upgrade da base de alguém, ou só o dono paga?

**Q3 resposta:** _________

**Q4 — Downgrade?**
Se a base vai para RUÍNA e volta, ela mantém o nível ou volta ao 1?

**Q4 resposta:** _________

**Q5 — Requisito além de RAD?**
Para subir de nível precisa só de RAD, ou também de itens específicos (tipo "Blueprint de construção")?

**Q5 resposta:** _________

---

### Grupo 2: Proteção (Chance de Raid Falhar)

**Q6 — Faixa de proteção**
Nível 1 = 0% proteção. Nível 50 = quanto? A sua ideia foi 80%? Ou pode chegar a 90%/100%?
Tem um cap máximo que você quer garantir?

**Q6 resposta:** _________

**Q7 — O que acontece quando o raid falha?**
- (A) Raider vê mensagem "Raid bloqueado" e não gasta nada — pode tentar de novo
- (B) Raider perde o cooldown de 12h mesmo assim
- (C) Raider perde algum RAD como custo da tentativa
- (D) Outra

**Q7 resposta:** _________

**Q8 — A proteção é visível?**
O raider sabe o nível da base antes de tentar invadir? Ou é surpresa?

**Q8 resposta:** _________

---

### Grupo 3: Durabilidade (Tempo antes de Ruína)

**Q9 — Tempo atual de ruína**
Hoje está 3 dias sem login. No nível 50, qual seria? Você falou "30 dias" está certo?
Ou prefere que seja permanente (nunca vira ruína) no nível máximo?

**Q9 resposta:** _________

**Q10 — Custo diário de manutenção sobe com o nível?**
Hoje é 10 RAD/dia para qualquer base. Bases de nível alto deveriam custar mais pra manter?
Ex: nível 10 = 20 RAD/dia, nível 50 = 100 RAD/dia?
Ou o custo de manutenção fica fixo e só o tempo antes de ruinar muda?

**Q10 resposta:** _________

---

### Grupo 4: Duração do Raid

**Q11 — Escala de duração**
Hoje: 1h fixo. Com o sistema de níveis:
- Nível 1 = 1h
- Nível 50 = 12h
A escala é linear (cada nível +~14 min) ou você quer que suba mais devagar no início e acelere no fim?

**Q11 resposta:** _________

**Q12 — O raider vê o tempo antes de confirmar o raid?**
Quando clicar em Invadir, mostra "Esta base é nível 28 — raid levará 8h30. Confirmar?"

**Q12 resposta:** _________

---

### Grupo 5: Cores da Base no Mapa

**Q13 — Paleta de cores**
Você falou: amarelo → laranja → vermelho → roxo.
Rascunho de níveis:
- 1–4: Cinza (base fraca, padrão)
- 5–9: Amarelo
- 10–14: Âmbar/Laranja claro
- 15–19: Laranja
- 20–24: Vermelho
- 25–29: Vermelho escuro
- 30–34: Rosa/Fúcsia
- 35–39: Roxo claro
- 40–44: Roxo
- 45–50: Roxo escuro/profundo

Isso bate com o que você tinha na cabeça? Quer mudar alguma faixa?

**Q13 resposta:** _________

**Q14 — Efeito visual além da cor?**
Bases de nível alto ganham algum efeito extra no mapa? Ex:
- Glow/halo ao redor do marcador
- Ícone maior
- Número do nível visível no mapa
- Apenas a cor muda

**Q14 resposta:** _________

---

### Grupo 6: Zona de Propriedade

**Q15 — Raio por nível**
Você quer que o raio aumente linearmente com o nível ou só a partir de certo nível?
Ex: nível 1 já tem uma zona pequena (50m), ou só começa a ter zona a partir do nível 5?
E nível 50 = 2km de raio está OK?

**Q15 resposta:** _________

**Q16 — O círculo é visível para todos no mapa?**
Qualquer jogador vê o círculo de propriedade de bases alheias, ou só o dono vê o próprio?

**Q16 resposta:** _________

**Q17 — Plantar base dentro de zona alheia**
Se eu tento plantar uma base dentro da zona de propriedade de alguém:
- (A) Bloqueado totalmente — não deixa
- (B) Deixa plantar mas começa a cobrança automática de 50 RAD/24h
- (C) Só bloqueia se a outra base for de certo nível mínimo

**Q17 resposta:** _________

**Q18 — Bases já existentes**
Se eu tenho uma base no nível 5 e você evolui a sua para nível 10, e agora minha base cai dentro da sua zona — o que acontece?
- (A) Começa a me cobrar imediatamente
- (B) Tenho X horas de graça para mover antes de começar a cobrar
- (C) Não retroage — só vale pra bases novas

**Q18 resposta:** _________

**Q19 — Cobrança: quem recebe o RAD?**
Os 50 RAD cobrados por dia do invadido de zona — vão para o dono da base maior?
Ou vão para um "banco" do sistema (sumindo da economia)?

**Q19 resposta:** _________

**Q20 — Suspensão de itens**
Quando a base não tem RAD para pagar o aluguel de zona, os itens ficam "suspensos".
O que exatamente isso significa na prática?
- (A) O dono não consegue retirar itens do stash (bloqueado), mas o stash fica visível
- (B) Os itens ficam invisíveis/inacessíveis até pagar
- (C) Qualquer player pode saquear o stash suspenso (como uma ruína)
- (D) Outra

**Q20 resposta:** _________

---

### Grupo 7: Conflito de Zonas

**Q21 — Zona vs Zona: quem ganha?**
Se duas bases de alto nível ficam perto e as zonas de propriedade se sobrepõem — o que acontece?
- (A) Quem tiver nível maior "domina" a área sobreposta
- (B) Ambos cobram do outro (guerra de aluguel)
- (C) Ninguém pode ter base de nível alto perto do outro — é bloqueado
- (D) Fica livre — a zona é só informativa, não exclusiva

**Q21 resposta:** _________

**Q22 — Múltiplas bases por player**
Um player pode ter mais de uma base? Se sim, todas se beneficiam do sistema de zonas?

**Q22 resposta:** _________

---

### Grupo 8: UI e Experiência

**Q23 — Onde fica o botão de upgrade?**
Dentro do BaseView que acabamos de criar, numa seção "EVOLUIR BASE"?
Ou em outro lugar?

**Q23 resposta:** _________

**Q24 — Notificações de propriedade**
Quando alguém entra na minha zona, recebo notificação? Quando começa a cobrança?

**Q24 resposta:** _________

**Q25 — Interface do aluguel**
No BaseView de quem está DENTRO de uma zona alheia, mostra claramente que está pagando aluguel.
Mas quem é o "dono da zona" — aparece o nome dele?

**Q25 resposta:** _________
