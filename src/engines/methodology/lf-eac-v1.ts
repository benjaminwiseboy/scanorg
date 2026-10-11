// Référentiel LF-EAC-V1 — 42 questions exactes (Build Pack V4, partie 05.1).
// Source unique : utilisée par le seed et par les moteurs. Ne pas modifier sans
// créer une nouvelle version de méthodologie.

export const METHODOLOGY_CODE = "LF-EAC-V1";

export type PillarCode = "E" | "A" | "C";
export type DimensionCode =
  | "E1" | "E2" | "E3"
  | "A1" | "A2" | "A3"
  | "C1" | "C2" | "C3";

export const PILLARS: { code: PillarCode; name: string }[] = [
  { code: "E", name: "Essence" },
  { code: "A", name: "Alliance" },
  { code: "C", name: "Cohérence" },
];

// Le Build Pack ne nomme pas explicitement les dimensions : ces libellés sont
// déduits des configurations V1 (07.6) et restent PROVISOIRES (à valider).
export const DIMENSIONS: { code: DimensionCode; pillar: PillarCode; name: string }[] = [
  { code: "E1", pillar: "E", name: "Identité" },
  { code: "E2", pillar: "E", name: "Cap & alignement" },
  { code: "E3", pillar: "E", name: "Incarnation" },
  { code: "A1", pillar: "A", name: "Sécurité d'expression" },
  { code: "A2", pillar: "A", name: "Autonomie & information" },
  { code: "A3", pillar: "A", name: "Équité & coopération" },
  { code: "C1", pillar: "C", name: "Fluidité organisationnelle" },
  { code: "C2", pillar: "C", name: "Ressources" },
  { code: "C3", pillar: "C", name: "Soutenabilité" },
];

export const QUESTIONS: { number: number; dimension: DimensionCode; text: string }[] = [
  { number: 1, dimension: "E1", text: "Je comprends clairement pourquoi notre organisation existe et ce qu'elle cherche à apporter." },
  { number: 2, dimension: "E1", text: "Je sais ce qui distingue réellement notre organisation des autres organisations qui font un travail similaire." },
  { number: 3, dimension: "E1", text: "Les valeurs affichées par notre organisation se retrouvent réellement dans les comportements du quotidien." },
  { number: 4, dimension: "E1", text: "Les décisions importantes de notre organisation restent généralement cohérentes avec ce qu'elle affirme être." },
  { number: 5, dimension: "E1", text: "Même lorsque les circonstances changent, nous savons ce qui ne doit pas être perdu de l'identité de notre organisation." },
  { number: 6, dimension: "E2", text: "Je comprends clairement les principales priorités de notre organisation pour la période actuelle." },
  { number: 7, dimension: "E2", text: "Je comprends comment mon travail contribue aux objectifs importants de notre organisation." },
  { number: 8, dimension: "E2", text: "Lorsque plusieurs priorités entrent en concurrence, nous savons suffisamment clairement lesquelles doivent passer en premier." },
  { number: 9, dimension: "E2", text: "Les différentes équipes et fonctions travaillent généralement dans une direction suffisamment cohérente avec les priorités de l'organisation." },
  { number: 10, dimension: "E2", text: "Lorsque le contexte change, notre organisation sait ajuster ses priorités sans perdre de vue son cap essentiel." },
  { number: 11, dimension: "E3", text: "Les personnes qui prennent les décisions importantes agissent de manière cohérente avec les principes et valeurs affichés par l'organisation." },
  { number: 12, dimension: "E3", text: "Lorsque des décisions importantes sont prises, les raisons qui les motivent sont généralement suffisamment expliquées." },
  { number: 13, dimension: "E3", text: "Les responsables reconnaissent leurs erreurs et prennent leur part de responsabilité lorsqu'une décision ou une action n'a pas produit le résultat attendu." },
  { number: 14, dimension: "E3", text: "Les responsables prennent suffisamment en compte les informations et les réalités remontées par les équipes avant de prendre certaines décisions." },
  { number: 15, dimension: "E3", text: "Même lorsque les décisions sont difficiles, les responsables savent généralement expliquer ce qui a conduit à leur choix." },
  { number: 16, dimension: "A1", text: "Je peux poser une question lorsque je ne comprends pas quelque chose, sans craindre d'être mal considéré(e)." },
  { number: 17, dimension: "A1", text: "Je peux exprimer un désaccord professionnel important sans craindre systématiquement des conséquences négatives." },
  { number: 18, dimension: "A1", text: "Lorsqu'une erreur est signalée, la priorité est généralement de comprendre ce qui s'est passé et d'en tirer des enseignements." },
  { number: 19, dimension: "A1", text: "Les difficultés ou problèmes importants peuvent être signalés suffisamment tôt, même lorsqu'ils risquent de déranger." },
  { number: 20, dimension: "A1", text: "Les personnes qui expriment une idée différente ou signalent un problème sont généralement traitées avec respect." },
  { number: 21, dimension: "A2", text: "Dans mon périmètre de responsabilité, je dispose généralement d'une marge de manœuvre suffisante pour accomplir correctement mon travail." },
  { number: 22, dimension: "A2", text: "Je sais clairement quelles décisions je peux prendre seul(e) et lesquelles nécessitent une validation." },
  { number: 23, dimension: "A2", text: "Je dispose généralement des informations nécessaires pour prendre de bonnes décisions dans mon travail." },
  { number: 24, dimension: "A2", text: "Les informations importantes qui concernent mon travail me parviennent généralement au bon moment." },
  { number: 25, dimension: "A2", text: "Lorsque mon travail dépend d'une autre équipe ou d'un autre service, la communication nécessaire à la coordination fonctionne généralement bien." },
  { number: 26, dimension: "A3", text: "Les règles qui s'appliquent aux collaborateurs sont généralement appliquées de manière cohérente, quel que soit leur niveau ou leur fonction." },
  { number: 27, dimension: "A3", text: "Les décisions concernant les opportunités professionnelles sont généralement fondées sur des critères que les personnes peuvent comprendre." },
  { number: 28, dimension: "A3", text: "Les efforts et contributions importants sont généralement reconnus de manière suffisamment juste." },
  { number: 29, dimension: "A3", text: "Dans notre organisation, les différences de point de vue, d'expérience ou de manière de travailler peuvent généralement être intégrées sans nuire durablement à la coopération." },
  { number: 30, dimension: "A3", text: "Lorsque des tensions apparaissent entre personnes ou équipes, elles peuvent généralement être traitées avant de détériorer durablement la coopération." },
  { number: 31, dimension: "C1", text: "Les principales responsabilités sont suffisamment claires pour que chacun sache qui doit faire quoi." },
  { number: 32, dimension: "C1", text: "Les processus de travail permettent généralement d'accomplir les tâches importantes sans étapes ou validations inutiles." },
  { number: 33, dimension: "C1", text: "Lorsque le travail passe d'une personne, d'une équipe ou d’un service à un autre, les informations et responsabilités nécessaires sont généralement transmises correctement." },
  { number: 34, dimension: "C1", text: "Lorsque nous rencontrons un problème récurrent dans notre façon de travailler, l'organisation cherche généralement à en corriger la cause plutôt qu'à simplement gérer ses conséquences." },
  { number: 35, dimension: "C2", text: "Je dispose généralement des moyens matériels et des outils nécessaires pour accomplir correctement mon travail." },
  { number: 36, dimension: "C2", text: "Les ressources disponibles sont généralement adaptées à la charge de travail et aux objectifs qui nous sont fixés." },
  { number: 37, dimension: "C2", text: "Les besoins importants en ressources sont généralement anticipés suffisamment tôt pour éviter des difficultés prévisibles." },
  { number: 38, dimension: "C2", text: "Notre organisation parvient généralement à maintenir une qualité de travail satisfaisante sans épuiser durablement les ressources dont elle dépend." },
  { number: 39, dimension: "C3", text: "La charge de travail est généralement compatible avec les ressources et le temps réellement disponibles." },
  { number: 40, dimension: "C3", text: "Dans notre organisation, nous avons généralement suffisamment de temps pour traiter les sujets importants sans fonctionner constamment dans l'urgence." },
  { number: 41, dimension: "C3", text: "Nous identifions et réduisons régulièrement les tâches, réunions, procédures ou activités qui consomment de l'énergie sans apporter suffisamment de valeur." },
  { number: 42, dimension: "C3", text: "Notre organisation est capable d'obtenir des résultats satisfaisants sans dépendre durablement de la surcharge, de l'épuisement ou d'efforts exceptionnels." },
];

// Blocs d'écrans du scanner (partie 04 — D, écrans 24 à 32).
export const SCANNER_BLOCKS: [number, number][] = [
  [1, 5], [6, 10], [11, 15], [16, 20], [21, 25], [26, 30], [31, 34], [35, 38], [39, 42],
];
