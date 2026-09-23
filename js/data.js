const STOP_RU = new Set(("и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о из ему теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам сказал ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь этом один почти мой тем чтобы нее сейчас были куда зачем всех никогда можно при наконец два об другой хоть после над больше тот через эти нас про всего них какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя такой им более всегда конечно всю между это который также которая которые которых которую этому которое либо однако кроме нежели вами тобою итак поэтому таким образом является являются были будут").split(' '));

const STOP_EN = new Set(("a an the and or but if then else when while of to in on at for with without by from as is are was were be been being this that these those it its it's i you he she we they them his her their our your my me him us not no nor so than too very can will just don't should now also into over under again further once here there all any both each few more most other some such only own same either neither which who whom whose what where why how do does did doing having have has had".split(' ')));

const ABBR_RU = new Set(['т.д','т.е','т.п','т.к','г','гг','проф','др','им','стр','рис','см','тыс','руб','акад','ул','обл','гор','г-н','г-жа','напр']);
const ABBR_EN = new Set(['mr','mrs','ms','dr','vs','etc','fig','no','st','prof','approx','e.g','i.e','al']);

const DOMAIN_TERMS = {
  medicine: ("пациент пациентов диагноз диагностика симптом симптомы лечение терапия клинический клиника заболевание заболевания болезнь врач медицинский исследование препарат дозировка терапевтический синдром хронический острый вакцина вакцинация иммунитет инфекция обследование анамнез рецидив patient diagnosis symptom treatment therapy clinical disease illness doctor medical study drug dosage therapeutic syndrome chronic acute vaccine vaccination immunity infection examination relapse clinician trial".split(' ')),
  art: ("картина полотно живопись художник композиция колорит мазок экспозиция выставка галерея искусство искусствоведческий стиль жанр холст палитра критик критика импрессионизм экспрессия форма перспектива painting canvas artist composition palette brushwork exhibition gallery art critic critique style genre aesthetic impression expression perspective sculpture museum curator".split(' '))
};

const DISCOURSE_MARKERS = [
  'таким образом', 'кроме того', 'тем не менее', 'однако', 'в целом', 'итак',
  'следует отметить, что', 'стоит отметить, что', 'в результате', 'в связи с этим',
  'прежде всего', 'в частности', 'между тем', 'в свою очередь', 'вместе с тем',
  'however', 'in addition', 'overall', 'moreover', 'furthermore', 'nevertheless',
  'in summary', 'in conclusion', 'as a result', 'first of all', 'for instance',
  'for example', 'in particular', 'meanwhile', 'in turn', 'that said'
];

const SAMPLES = [
{name:'RU · медицина.txt', text:
`Сезонная вакцинация против гриппа остаётся одним из наиболее обсуждаемых инструментов профилактической медицины. Ежегодно клиники фиксируют рост обращений с симптомами острой респираторной инфекции в осенне-зимний период. Врачи отмечают, что своевременная вакцинация снижает вероятность тяжёлого течения заболевания у пациентов старшей возрастной группы. Диагностика гриппа на ранней стадии затруднена из-за схожести симптомов с другими респираторными инфекциями.

В рамках клинического исследования была проанализирована группа из нескольких сотен пациентов, получивших вакцину за месяц до начала эпидемического сезона. У привитых пациентов зафиксировано статистически значимое снижение частоты осложнений и сокращение среднего срока лечения. Терапевтический эффект вакцинации оказался наиболее выраженным среди пациентов с хроническими заболеваниями дыхательной системы.

Тем не менее часть пациентов отказывается от вакцинации из-за опасений по поводу побочных эффектов. Врачи подчёркивают, что современные вакцины проходят строгий контроль и редко вызывают серьёзные реакции. Иммунитет после вакцинации формируется постепенно, поэтому прививку рекомендуют делать заблаговременно, до начала роста заболеваемости.

Итоговый анализ подтвердил, что массовая вакцинация снижает нагрузку на клиники в пиковый период эпидемии. Авторы исследования рекомендуют расширить программы вакцинации для групп риска и продолжить наблюдение за долгосрочным эффектом иммунитета.`},

{name:'RU · искусство.txt', text:
`Новая выставка в городской галерее объединяет работы художников, обратившихся к традициям импрессионизма в неожиданном ключе. Экспозиция построена вокруг темы света и его изменчивости на полотне в течение дня. Каждая картина демонстрирует характерный для этого направления свободный мазок и насыщенный колорит.

Критика отмечает, что композиция залов выстроена продуманно: зритель движется от ранних, более сдержанных по палитре работ к поздним холстам с почти абстрактной трактовкой формы. Такой маршрут по экспозиции подчёркивает эволюцию художника внутри одного стиля. Отдельного внимания заслуживает работа с перспективой — художник намеренно смещает точку схода, создавая ощущение неустойчивости композиции.

Искусствоведческая критика также обращает внимание на выбор палитры: преобладание тёплых охристых и терракотовых тонов придаёт полотнам почти театральную выразительность. Некоторые картины выполнены практически без предварительного рисунка, что подчёркивает спонтанность мазка.

В целом выставка воспринимается как удачная попытка галереи показать импрессионизм не как застывший исторический стиль, а как живой источник для новых экспериментов с формой и колоритом.`},

{name:'EN · medicine.txt', text:
`Clinical researchers have long examined how early diagnosis influences the outcome of chronic respiratory disease. A recent study followed a cohort of patients presenting with recurring symptoms over an eighteen month period. Doctors involved in the trial noted that patients who received treatment shortly after the first clinical examination showed a shorter recovery time than those diagnosed later.

The therapeutic protocol combined a standard drug regimen with closer monitoring of dosage during the acute phase of the illness. Patients with a documented history of relapse were given particular attention, since their immune response to therapy tended to be less predictable. The clinical team reported that adjusting dosage individually, rather than relying on a fixed schedule, reduced the rate of complications significantly.

Vaccination was also considered as a preventive measure for patients at high risk of infection during the study. While most patients tolerated the vaccine without notable side effects, the study authors caution that further trials are needed before drawing firm conclusions about long term immunity. The diagnosis process itself remains the main bottleneck, since early symptoms of the disease often overlap with more common seasonal infections.

Overall, the study suggests that combining earlier diagnosis with individualised therapeutic dosing offers a meaningful improvement over the standard treatment pathway for chronic patients.`},

{name:'EN · art criticism.txt', text:
`The gallery's latest exhibition brings together a small group of painters working at the edge of figurative and abstract composition. Each canvas plays with perspective in a way that unsettles the viewer's first reading of the scene, pulling the eye toward an unexpected vanishing point. The curator has arranged the rooms so that the palette gradually shifts from muted earth tones to intense, almost theatrical colour.

Critics attending the opening praised the exhibition's handling of brushwork, noting how visible, gestural strokes give several paintings an unfinished, spontaneous quality that nonetheless feels deliberate. One painting in particular, built around a fractured composition of interior space, has already become the centrepiece of the show's critical reception. The artist's use of colour here recalls earlier impressionist experiments with light, though the underlying composition owes more to twentieth century abstraction.

Some reviewers have questioned whether the exhibition's loose curatorial theme dilutes the individual strength of each canvas, arguing that the show reads more like a survey than a focused statement. Others see this breadth as the exhibition's main achievement, allowing each artist's approach to composition and palette to be judged on its own terms rather than forced into a single narrative.

Taken together, the exhibition offers a useful, if occasionally uneven, cross-section of how contemporary painters are reworking the vocabulary of perspective, brushwork and colour inherited from earlier movements.`}
];
