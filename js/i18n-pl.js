// Polski przekład interfejsu. Klucz — rosyjski tekst źródłowy, wartość — polski.
// {n}, {side} itd. to wstawiane wartości. Funkcja zamiast tekstu = odmiana przez liczby.
// Strony: «po prawej» / «prawej» / «prawa» (patrz exercises.js → side).

// Liczba mnoga po polsku: 1 sesja, 2–4 sesje (bez 12–14), 5+ sesji.
const pl = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  if (n === 1) return one;
  if (b >= 2 && b <= 4 && !(a >= 12 && a <= 14)) return few;
  return many;
};

export const PL = {
  // ——— analysis.js: komentarze po ćwiczeniu ———
  'Выполнено.': 'Wykonane.',
  'Камера не смогла оценить это упражнение — лицо было плохо видно. Ничего страшного, само упражнение засчитано.':
    'Kamera nie mogła ocenić tego ćwiczenia — twarz była słabo widoczna. Nic nie szkodzi, ćwiczenie i tak się liczy.',
  'На {side} стороне есть движение в {m} из {n} повторов.': ({ n }) =>
    `Po {side} stronie widać ruch w {m} z {n} ${n === 1 ? 'powtórzenia' : 'powtórzeń'}.`,
  'Это примерно {p}% от движения здоровой стороны.': 'To około {p}% ruchu zdrowej strony.',
  'Движение на {side} стороне камера пока не видит. На этом этапе это нормально: главное — спокойно посылать импульс в мышцу.':
    'Kamera nie widzi jeszcze ruchu po {side} stronie. Na tym etapie to normalne: najważniejsze jest spokojne wysyłanie impulsu do mięśnia.',
  'Глаз на {side} стороне закрывается примерно на {p}%.': 'Oko po {side} stronie zamyka się w około {p}%.',
  'Для этого упражнения камера различает стороны неточно — лучше ориентироваться на зеркало.':
    'W tym ćwiczeniu kamera nie odróżnia dokładnie stron — lepiej kieruj się lustrem.',
  'Отмечено: с помощью пальцев.': 'Zaznaczono: z pomocą palców.',
  'К концу движения стали слабее — мышцы устали. Так и должно быть, не форсируйте.':
    'Pod koniec ruchy osłabły — mięśnie się zmęczyły. Tak ma być, nie forsuj się.',
  'Заметно прищуривание глаза во время движения рта. Стоит показать это реабилитологу.':
    'Widać mrużenie oka podczas ruchu ust. Warto pokazać to fizjoterapeucie.',

  // ——— ekran główny ———
  'Мимика — гимнастика для лица': 'Mimika — gimnastyka twarzy',
  'Мимика': 'Mimika',
  'сегодня': 'dzisiaj',
  'вчера': 'wczoraj',
  'Доброй ночи': 'Dobry wieczór',
  'Доброе утро': 'Dzień dobry',
  'Добрый день': 'Dzień dobry',
  'Добрый вечер': 'Dobry wieczór',
  'Сегодня {n} из {max} занятий': 'Dzisiaj: {n} z {max} sesji',
  'Сегодня занятий ещё не было': 'Dzisiaj jeszcze nie było ćwiczeń',
  'Последнее занятие: {day} в {time}, {min} мин': 'Ostatnia sesja: {day} o {time}, {min} min',
  'Займёт 10–15 минут. Понадобится подставка для телефона и хороший свет.':
    'Zajmie 10–15 minut. Przyda się podstawka na telefon i dobre światło.',
  'Вы отметили подёргивания {day}. Памятка советует перерыв 1–2 дня.':
    'Drgania zostały zaznaczone {day}. Zalecenia: 1–2 dni przerwy.',
  'Сегодня уже {n} занятия — этого достаточно. Мышцам тоже нужен отдых.': ({ n }) =>
    `Dzisiaj już {n} ${pl(n, 'sesja', 'sesje', 'sesji')} — to wystarczy. Mięśnie też potrzebują odpoczynku.`,
  'Ждут отправки на Raspberry Pi: {n}. Отправятся автоматически, когда сервер будет доступен.':
    'Czeka na wysłanie do Raspberry Pi: {n}. Wyślą się automatycznie, gdy serwer będzie dostępny.',
  'Копия на Raspberry Pi: {day} в {time}.': 'Kopia na Raspberry Pi: {day} o {time}.',
  'Настройки': 'Ustawienia',
  'Пора сделать еженедельную проверку': 'Czas na cotygodniową kontrolę',
  '1–2 минуты, покажет изменения за неделю': '1–2 minuty, pokaże zmiany z tygodnia',
  'Начать занятие': 'Rozpocznij ćwiczenia',
  'Самомассаж': 'Automasaż',
  'История': 'Historia',
  'Видео не записывается и никуда не отправляется. На телефоне сохраняются только измерения.':
    'Wideo nie jest nagrywane ani nigdzie wysyłane. Na telefonie zapisywane są tylko pomiary.',

  // ——— przed sesją ———
  'Назад': 'Wstecz',
  'На главную': 'Na ekran główny',
  'Перед началом': 'Przed rozpoczęciem',
  'Сейчас есть подёргивания мышц лица или сильное напряжение?': 'Czy masz teraz drgania mięśni twarzy albo silne napięcie?',
  'Нет, всё спокойно': 'Nie, wszystko w porządku',
  'Да, есть': 'Tak, mam',
  'Лучше сделать перерыв': 'Lepiej zrobić przerwę',
  'При подёргиваниях или сильном напряжении памятка советует отдохнуть 1–2 дня. Лицо не нужно перегружать.':
    'Przy drganiach lub silnym napięciu zalecenia mówią: 1–2 dni odpoczynku. Nie przeciążaj twarzy.',
  'Если подёргивания сохраняются или усиливаются, расскажите об этом врачу.':
    'Jeśli drgania nie ustępują albo się nasilają, powiedz o tym lekarzowi.',
  'Хорошо, отдохну': 'Dobrze, odpocznę',
  'Только лёгкий самомассаж': 'Tylko lekki automasaż',
  'Всё равно начать упражнения': 'Mimo to rozpocznij ćwiczenia',
  'Сначала самомассаж?': 'Najpierw automasaż?',
  '5–8 минут лёгких поглаживаний разогревают ткани. После них мышцы лучше отвечают на упражнения.':
    '5–8 minut lekkiego głaskania rozgrzewa tkanki. Potem mięśnie lepiej reagują na ćwiczenia.',
  'Сделать самомассаж': 'Zrób automasaż',
  'Сразу к упражнениям': 'Od razu do ćwiczeń',

  // ——— automasaż ———
  'Запустить таймер на 6 минут': 'Włącz minutnik na 6 minut',
  'Остановить таймер': 'Zatrzymaj minutnik',
  'Самомассаж окончен': 'Automasaż zakończony',
  'Самомассаж перед гимнастикой': 'Automasaż przed gimnastyką',
  'Все движения лёгкие, поглаживающие и безболезненные. Без растирания, сдвигания кожи и надавливания. Чистыми руками, перед зеркалом, подушечками пальцев — от центра лица к периферии и вниз.':
    'Wszystkie ruchy są lekkie, głaszczące i bezbolesne. Bez rozcierania, przesuwania skóry i uciskania. Czystymi rękami, przed lustrem, opuszkami palców — od środka twarzy na zewnątrz i w dół.',
  'Область глаз': 'Okolice oczu',
  'Поглаживайте по кругу: от внутреннего угла глаза по верхнему веку к наружному углу, затем по нижнему веку обратно. Очень нежно, не растягивая кожу век. 3–4 раза.':
    'Głaszcz po okręgu: od wewnętrznego kącika oka po górnej powiece do zewnętrznego kącika, potem po dolnej powiece z powrotem. Bardzo delikatnie, nie naciągając skóry powiek. 3–4 razy.',
  'Щёки': 'Policzki',
  'Тремя пальцами — указательным, средним и безымянным — по трём линиям: от крыльев носа к верхней части уха, от уголков рта к середине уха, от центра подбородка к мочке уха. Каждое движение завершайте поглаживанием вниз по боковой поверхности шеи. 5–6 раз.':
    'Trzema palcami — wskazującym, środkowym i serdecznym — wzdłuż trzech linii: od skrzydełek nosa do górnej części ucha, od kącików ust do środka ucha, od środka brody do płatka ucha. Każdy ruch kończ głaskaniem w dół po bocznej stronie szyi. 5–6 razy.',
  'Пальцевый душ': 'Delikatne oklepywanie',
  'Лёгкие, очень мягкие похлопывания подушечками пальцев по поражённой стороне — от центра к периферии.':
    'Lekkie, bardzo delikatne oklepywanie opuszkami palców po słabszej stronie — od środka na zewnątrz.',
  'Если здоровая сторона перетягивает': 'Jeśli zdrowa strona przeciąga',
  'Её, наоборот, расслабляйте чуть более глубокими поглаживаниями, а во время гимнастики придерживайте ладонью.':
    'Ją z kolei rozluźniaj nieco głębszym głaskaniem, a podczas gimnastyki przytrzymuj dłonią.',
  'Готово': 'Gotowe',

  // ——— kamera i przygotowanie ———
  'Еженедельная проверка': 'Cotygodniowa kontrola',
  'Подготовка': 'Przygotowanie',
  'Включаю камеру…': 'Włączam kamerę…',
  'Поставьте телефон на подставку на уровне глаз, примерно в 40 см от лица. Лицо — прямо к камере, свет — спереди.':
    'Postaw telefon na podstawce na wysokości oczu, około 40 cm od twarzy. Twarz prosto do kamery, światło z przodu.',
  'Нет доступа к камере': 'Brak dostępu do kamery',
  'Разрешите доступ к камере: в Safari нажмите «аА» в адресной строке → «Настройки веб-сайта» → «Камера» → «Разрешить». Для приложения на экране «Домой» — «Настройки» iPhone → «Safari» → «Камера».':
    'Zezwól na dostęp do kamery: w Safari stuknij «aA» w pasku adresu → «Ustawienia witryny» → «Kamera» → «Pozwalaj». Dla aplikacji na ekranie początkowym — «Ustawienia» iPhone’a → «Safari» → «Kamera».',
  'Попробовать снова': 'Spróbuj ponownie',
  'Загружаю распознавание лица…': 'Ładuję rozpoznawanie twarzy…',
  'Не удалось загрузить распознавание': 'Nie udało się załadować rozpoznawania',
  'При первом запуске нужен интернет — приложение скачивает модель (около 4 МБ). Потом она работает и без сети.':
    'Przy pierwszym uruchomieniu potrzebny jest internet — aplikacja pobiera model (ok. 4 MB). Potem działa także bez sieci.',
  'Устройтесь поудобнее': 'Usiądź wygodnie',
  'Лицо в кадре': 'Twarz w kadrze',
  'Смотрите прямо': 'Patrz prosto',
  'Достаточно света': 'Wystarczająco światła',
  'Лицо не видно': 'Nie widać twarzy',
  'Поднесите телефон ближе': 'Przybliż telefon',
  'Отодвиньте телефон чуть дальше': 'Odsuń telefon trochę dalej',
  'Повернитесь лицом к камере': 'Zwróć twarz do kamery',
  'Держите голову ровно': 'Trzymaj głowę prosto',
  'Мало света — повернитесь к окну или лампе': 'Za mało światła — odwróć się do okna lub lampy',
  'Проверим стороны': 'Sprawdźmy strony',
  'Оранжевые точки должны быть на вашей {side} стороне лица — там, где слабее движение. Голубые — на здоровой.':
    'Pomarańczowe punkty powinny być na {side} stronie twarzy — tam, gdzie ruch jest słabszy. Niebieskie — na zdrowej.',
  'Да, верно': 'Tak, zgadza się',
  'Нет, на другой стороне': 'Nie, są po drugiej stronie',
  'Поменяла стороны. Проверьте ещё раз.': 'Strony zamienione. Sprawdź jeszcze raz.',
  'Запоминаю лицо в покое': 'Zapamiętuję twarz w spoczynku',
  'Расслабьте лицо и спокойно смотрите в камеру пару секунд.': 'Rozluźnij twarz i spokojnie patrz w kamerę przez kilka sekund.',
  'Расслабьте лицо и смотрите в камеру': 'Rozluźnij twarz i patrz w kamerę',

  // ——— w trakcie ćwiczeń ———
  'Пауза': 'Pauza',
  'Завершить': 'Zakończ',
  'Помогаю себе пальцами': 'Pomagam sobie palcami',
  'Начать': 'Start',
  'Пропустить': 'Pomiń',
  'Дальше': 'Dalej',
  'Повтор начнётся заново, когда продолжите.': 'Powtórzenie zacznie się od nowa, gdy wznowisz.',
  'Продолжить': 'Wznów',
  'Упражнение {i} из {n}': 'Ćwiczenie {i} z {n}',
  'Повтор {i} из {n}': 'Powtórzenie {i} z {n}',
  'Расслабьте лицо': 'Rozluźnij twarz',
  'Расслабьте': 'Rozluźnij',
  'Дальше: {cue}': 'Dalej: {cue}',
  'Плавно, без усилия': 'Płynnie, bez wysiłku',
  'Есть движение {side}!': 'Jest ruch {side}!',
  'Мягче. Здоровую сторону можно придержать ладонью': 'Delikatniej. Zdrową stronę możesz przytrzymać dłonią',
  'Движения стали слабее — мышцы устали. Заканчиваем это упражнение.': 'Ruchy osłabły — mięśnie się zmęczyły. Kończymy to ćwiczenie.',
  'Прошло 15 минут — на сегодня достаточно.': 'Minęło 15 minut — na dziś wystarczy.',
  'Завершить занятие': 'Zakończ sesję',
  'Следующее упражнение': 'Następne ćwiczenie',
  'Прервать проверку? Результат не сохранится.': 'Przerwać kontrolę? Wynik nie zostanie zapisany.',
  'Завершить занятие?': 'Zakończyć sesję?',

  // ——— cotygodniowa kontrola ———
  'Проверка. Четыре выражения, по две попытки. Спокойно, как на занятиях.':
    'Kontrola. Cztery ruchy mimiczne, po dwie próby. Spokojnie, jak podczas ćwiczeń.',
  'Проверка: {pose}': 'Kontrola: {pose}',
  'Проверка завершена. Спасибо!': 'Kontrola zakończona. Dziękuję!',
  'Не получилось измерить. Попробуйте при лучшем свете.': 'Nie udało się zmierzyć. Spróbuj przy lepszym świetle.',
  'Проверка сохранена': 'Kontrola zapisana',
  'Не удалось измерить — попробуйте при лучшем свете': 'Nie udało się zmierzyć — spróbuj przy lepszym świetle',
  'Брови': 'Brwi',
  'Глаза': 'Oczy',
  'Улыбка': 'Uśmiech',
  'Трубочка': 'Dzióbek',
  'Покой': 'Spoczynek',
  'мало света': 'mało światła',
  'другое расстояние до камеры': 'inna odległość od kamery',
  'не все попытки измерены': 'nie wszystkie próby zmierzone',

  // ——— podsumowanie sesji ———
  'Занятие завершено. Спасибо!': 'Sesja zakończona. Dziękuję!',
  '{a} из {b}': '{a} z {b}',
  'Занятие завершено': 'Sesja zakończona',
  'Занятие прервано': 'Sesja przerwana',
  '{min} мин. Выполнено упражнений: {done} из {all}.': '{min} min. Wykonane ćwiczenia: {done} z {all}.',
  'Камера увидела движение на {side} стороне в {n} повторах. Каждый такой импульс — это работа нерва.': ({ n }) =>
    `Kamera wykryła ruch po {side} stronie w {n} ${n === 1 ? 'powtórzeniu' : 'powtórzeniach'}. Każdy taki impuls to praca nerwu.`,
  'Сегодня камера не увидела движения на поражённой стороне. После операции восстановление обычно занимает недели и месяцы — регулярные спокойные попытки важнее результата каждого дня.':
    'Dzisiaj kamera nie wykryła ruchu po słabszej stronie. Po operacji powrót sprawności zwykle trwa tygodnie i miesiące — regularne, spokojne próby są ważniejsze niż wynik jednego dnia.',
  'пропущено': 'pominięte',
  'Как лицо после занятия?': 'Jak twarz po ćwiczeniach?',
  'Хорошо': 'Dobrze',
  'Устало': 'Zmęczona',
  'Подёргивания': 'Drgania',
  'Отмечено. Памятка советует перерыв на 1–2 дня.': 'Zaznaczono. Zalecenia: 1–2 dni przerwy.',
  'Скопировать отчёт': 'Kopiuj raport',

  // ——— raport ———
  'хорошо': 'dobrze',
  'устало': 'zmęczenie',
  'подёргивания': 'drgania',
  'Мимика — отчёт о лицевой гимнастике': 'Mimika — raport z gimnastyki twarzy',
  '{date} {time}, {min} мин. Поражённая сторона: {side}.': '{date} {time}, {min} min. Strona porażona: {side}.',
  'Перед занятием — самомассаж.': 'Przed sesją — automasaż.',
  'выполнено': 'wykonane',
  'движение на поражённой стороне в {m} из {n} повторов': ({ n }) =>
    `ruch po stronie porażonej w {m} z {n} ${n === 1 ? 'powtórzenia' : 'powtórzeń'}`,
  '≈{p}% от здоровой стороны': '≈{p}% zdrowej strony',
  '≈{a} мм против {h} мм': '≈{a} mm wobec {h} mm',
  'глаз закрывается ≈ на {a}% (здоровый — {h}%)': 'oko zamyka się w ≈{a}% (zdrowe — {h}%)',
  'с помощью пальцев': 'z pomocą palców',
  'к концу — усталость': 'pod koniec — zmęczenie',
  'прищуривание глаза при движении рта в {n} повторах': ({ n }) =>
    `mrużenie oka przy ruchu ust w {n} ${n === 1 ? 'powtórzeniu' : 'powtórzeniach'}`,
  'нет данных камеры': 'brak danych z kamery',
  'После занятия: {feel}.': 'Po sesji: {feel}.',
  'Измерения приблизительные (камера телефона). Не является медицинским заключением.':
    'Pomiary są przybliżone (kamera telefonu). To nie jest opinia medyczna.',
  'Отчёт скопирован': 'Raport skopiowany',
  'Не удалось скопировать': 'Nie udało się skopiować',

  // ——— historia ———
  'Линия показывает, насколько движение поражённой стороны близко к здоровой (медиана по упражнениям). Точки — доля повторов, в которых камера увидела движение.':
    'Linia pokazuje, jak bardzo ruch słabszej strony zbliża się do zdrowej (mediana z ćwiczeń). Kropki — odsetek powtórzeń, w których kamera wykryła ruch.',
  'После второго занятия здесь появится график.': 'Wykres pojawi się tu po drugiej sesji.',
  'Пока нет занятий. Первое займёт 10–15 минут.': 'Na razie brak sesji. Pierwsza zajmie 10–15 minut.',
  'График восстановления': 'Wykres postępów',
  'движение в {m} из {n}': 'ruch w {m} z {n}',
  'нет данных': 'brak danych',
  '{min} мин': '{min} min',
  'Прогресс и еженедельные проверки': 'Postępy i cotygodniowe kontrole',
  'Дашборд занятий': 'Panel ćwiczeń',
  'Скопировать отчёт за 7 дней': 'Kopiuj raport z 7 dni',
  'За последние 7 дней занятий нет': 'Brak sesji w ostatnich 7 dniach',

  // ——— postępy ———
  'Прогресс': 'Postępy',
  'Раз в неделю — короткая проверка: лицо в покое и четыре выражения, по две попытки. Одинаковые условия делают недели сравнимыми между собой.':
    'Raz w tygodniu — krótka kontrola: twarz w spoczynku i cztery ruchy mimiczne, po dwie próby. Te same warunki pozwalają porównywać tygodnie ze sobą.',
  'Тот же свет, то же место и та же подставка, что и в прошлый раз — тогда сравнение честнее.':
    'To samo światło, to samo miejsce i ta sama podstawka co ostatnio — wtedy porównanie jest rzetelniejsze.',
  'Это то, что увидела камера телефона, приблизительно. Небольшие изменения она может не заметить, а свет и расстояние влияют на результат. Фото хранятся только на этом телефоне. Оценивать восстановление — вместе с врачом.':
    'To, co zobaczyła kamera telefonu, w przybliżeniu. Małych zmian może nie zauważyć, a światło i odległość wpływają na wynik. Zdjęcia są przechowywane tylko na tym telefonie. Postępy oceniaj razem z lekarzem.',
  'Сделать проверку': 'Zrób kontrolę',
  'Сделать первую проверку': 'Zrób pierwszą kontrolę',
  'Первая проверка станет точкой отсчёта. Через неделю здесь появится сравнение.':
    'Pierwsza kontrola będzie punktem odniesienia. Za tydzień pojawi się tu porównanie.',
  'Фото: первая и последняя проверка': 'Zdjęcia: pierwsza i ostatnia kontrola',
  'Фото: точка отсчёта': 'Zdjęcia: punkt odniesienia',
  'Первая: {day}': 'Pierwsza: {day}',
  'Точка отсчёта: {day}': 'Punkt odniesienia: {day}',
  'Последняя: {day}': 'Ostatnia: {day}',
  'Через неделю здесь появится новое фото для сравнения': 'Za tydzień pojawi się tu nowe zdjęcie do porównania',
  'Что видела камера': 'Co widziała kamera',
  'Сплошная линия — {a} (лучшая из двух попыток), полоса — разброс попыток. Пунктир — {h}. Оранжевая точка — неделя с неидеальными условиями.':
    'Linia ciągła — {a} (lepsza z dwóch prób), pasek — rozrzut prób. Linia przerywana — {h}. Pomarańczowa kropka — tydzień z nieidealnymi warunkami.',
  'Все проверки': 'Wszystkie kontrole',
  'Фото проверки': 'Zdjęcie z kontroli',
  'Фото нет': 'Brak zdjęcia',
  'Нет данных': 'Brak danych',
  'мм': 'mm',
  '(попытки {lo}–{hi}{u})': '(próby {lo}–{hi}{u})',
  'глаз {side} закрывается ≈ на {v}%{range}': 'oko {side} zamyka się w ≈{v}%{range}',
  '{side} ≈{v} мм{range}': '{side} ≈{v} mm{range}',
  '{side} движение не обнаружено': '{side} nie wykryto ruchu',
  'Последняя: {a}; {h}.': 'Ostatnia: {a}; {h}.',
  '{title}: тренд': '{title}: trend',

  // ——— ustawienia ———
  'Поражённая сторона лица': 'Strona porażona',
  'Правая': 'Prawa',
  'Левая': 'Lewa',
  'Повторов в упражнении': 'Powtórzeń w ćwiczeniu',
  'Темп': 'Tempo',
  'Размеренный': 'Umiarkowane',
  'Медленный': 'Wolne',
  'Очень медленный': 'Bardzo wolne',
  'Напряжение {e} с, отдых {r} с. Занятие займёт около {min} мин.': 'Napięcie {e} s, odpoczynek {r} s. Sesja zajmie około {min} min.',
  'Это больше 15 минут из памятки — уменьшите число повторов или отключите часть упражнений.':
    'To więcej niż 15 minut z zaleceń — zmniejsz liczbę powtórzeń albo wyłącz część ćwiczeń.',
  'Голосовые подсказки': 'Podpowiedzi głosowe',
  'Упражнения в занятии': 'Ćwiczenia w sesji',
  'Если реабилитолог изменит программу, отключите лишнее здесь.': 'Jeśli fizjoterapeuta zmieni program, wyłącz tu zbędne ćwiczenia.',
  'Нужно оставить хотя бы одно упражнение': 'Zostaw przynajmniej jedno ćwiczenie',
  'Данные': 'Dane',
  'Экспорт данных': 'Eksport danych',
  'Удалить всё': 'Usuń wszystko',
  'Точки на лице легли не на ту сторону': 'Punkty na twarzy są po złej stronie',
  'Удалить все занятия и настройки с этого телефона? Копия на Raspberry Pi, если она подключена, останется.':
    'Usunąć wszystkie sesje i ustawienia z tego telefonu? Kopia na Raspberry Pi, jeśli jest podłączona, zostanie.',
  'Данные удалены': 'Dane usunięte',
  'Мимика помогает выполнять упражнения из вашей памятки и видеть изменения. Это не медицинское изделие: она не ставит диагноз и не заменяет врача или реабилитолога.':
    'Mimika pomaga wykonywać ćwiczenia z twoich zaleceń i widzieć zmiany. To nie jest wyrób medyczny: nie stawia diagnozy i nie zastępuje lekarza ani fizjoterapeuty.',

  // ——— kopia zapasowa ———
  'Резервная копия на Raspberry Pi': 'Kopia zapasowa na Raspberry Pi',
  'mimika-sync|https://…|ключ': 'mimika-sync|https://…|klucz',
  'Вставить': 'Wklej',
  'Подключить': 'Połącz',
  'Код настройки выдаёт установщик на Raspberry Pi.': 'Kod konfiguracji wyświetla instalator na Raspberry Pi.',
  'Синхронизировать': 'Synchronizuj',
  'Восстановить': 'Przywróć',
  'Открыть дашборд занятий': 'Otwórz panel ćwiczeń',
  'Отключить резервную копию': 'Wyłącz kopię zapasową',
  'Не настроено. История хранится только на этом телефоне.': 'Nie skonfigurowano. Historia jest zapisana tylko na tym telefonie.',
  'Сервер: {host}.': 'Serwer: {host}.',
  'Последняя копия: {day} в {time}.': 'Ostatnia kopia: {day} o {time}.',
  'Занятий на сервере: {n}.': 'Sesji na serwerze: {n}.',
  'Ждут отправки: {n}.': 'Czeka na wysłanie: {n}.',
  'Не удалось вставить. Нажмите на поле и выберите «Вставить».': 'Nie udało się wkleić. Stuknij pole i wybierz «Wklej».',
  'Проверяю…': 'Sprawdzam…',
  'Подключено. Занятия будут сохраняться на Raspberry Pi.': 'Połączono. Sesje będą zapisywane na Raspberry Pi.',
  'На сервере уже есть занятия: {n}. Загрузить их на телефон?': 'Na serwerze są już sesje: {n}. Pobrać je na telefon?',
  'Отправляю…': 'Wysyłam…',
  'Отправлено занятий: {n}': 'Wysłano sesji: {n}',
  'Всё уже сохранено на сервере': 'Wszystko jest już zapisane na serwerze',
  'Восстановлено занятий: {n}': 'Przywrócono sesji: {n}',
  'Новых занятий на сервере нет — всё уже на телефоне': 'Na serwerze nie ma nowych sesji — wszystko jest już na telefonie',
  'Загрузить историю с сервера? Занятия на телефоне сохранятся, недостающие будут добавлены.':
    'Pobrać historię z serwera? Sesje na telefonie zostaną, brakujące zostaną dodane.',
  'Загружаю…': 'Pobieram…',
  'Отключить резервную копию? Данные на телефоне и на сервере останутся, но новые занятия перестанут отправляться.':
    'Wyłączyć kopię zapasową? Dane na telefonie i na serwerze zostaną, ale nowe sesje nie będą wysyłane.',
  'Сервер недоступен. Проверьте, что Raspberry Pi включён и подключён к интернету.':
    'Serwer jest niedostępny. Sprawdź, czy Raspberry Pi jest włączone i ma dostęp do internetu.',
  'Сервер не ответил вовремя.': 'Serwer nie odpowiedział na czas.',
  'Неверный ключ доступа — вставьте код настройки заново.': 'Nieprawidłowy klucz dostępu — wklej kod konfiguracji ponownie.',
  'Код не распознан. Он должен начинаться с «mimika-sync|https://».': 'Nie rozpoznano kodu. Powinien zaczynać się od «mimika-sync|https://».',
  'Ошибка сервера ({status}).': 'Błąd serwera ({status}).',
  'Ошибка сервера.': 'Błąd serwera.',

  // ——— strony (exercises.js → side) ———
  'справа': 'po prawej',
  'слева': 'po lewej',
  'правая': 'prawa',
  'левая': 'lewa',
  'правой': 'prawej',
  'левой': 'lewej',

  // ——— ćwiczenia ———
  'Верхняя треть лица': 'Górna część twarzy',
  'Глаза и щёки': 'Oczy i policzki',
  'Губы и подбородок': 'Usta i broda',

  'Подъём бровей': 'Unoszenie brwi',
  'Поднимите брови': 'Unieś brwi',
  'Удивлённо поднимите брови — плавно, без усилия.': 'Unieś brwi jak w zdziwieniu — płynnie, bez wysiłku.',
  'Пальцами можно чуть приподнимать бровь на поражённой стороне, а на здоровой — придерживать, чтобы она не поднималась слишком высоко.':
    'Po słabszej stronie możesz lekko unosić brew palcami, a po zdrowej — przytrzymywać ją, żeby nie unosiła się zbyt wysoko.',

  'Сведение бровей': 'Ściąganie brwi',
  'Сведите брови': 'Ściągnij brwi',
  'Нахмурьтесь: сведите брови к переносице.': 'Zmarszcz brwi: ściągnij je do nasady nosa.',
  'Если движение не получается, плавно подтолкните бровь пальцем к центру.': 'Jeśli ruch nie wychodzi, delikatnie przesuń brew palcem do środka.',

  'Взгляд вверх и вниз': 'Spojrzenie w górę i w dół',
  'Взгляд вверх': 'Spójrz w górę',
  'Взгляд вниз': 'Spójrz w dół',
  'Взгляд прямо': 'Patrz prosto',
  'Смотрите прямо перед собой, затем медленно переводите взгляд вверх и вниз.': 'Patrz prosto przed siebie, potem powoli przenoś wzrok w górę i w dół.',
  'Голову не поднимайте и не опускайте.': 'Nie unoś ani nie opuszczaj głowy.',

  'Мягкое закрывание глаз': 'Delikatne zamykanie oczu',
  'Мягко закройте глаза': 'Delikatnie zamknij oczy',
  'Откройте глаза': 'Otwórz oczy',
  'Плавно опустите веки, как будто засыпаете.': 'Powoli opuść powieki, jak przy zasypianiu.',
  'Не зажмуривайтесь с силой. Если глаз не закрывается полностью, аккуратно опустите верхнее веко подушечкой пальца.':
    'Nie zaciskaj oczu na siłę. Jeśli oko nie zamyka się do końca, delikatnie opuść górną powiekę opuszkiem palca.',
  'Когда глаза закрыты, ориентируйтесь на голос.': 'Gdy oczy są zamknięte, kieruj się głosem.',

  'Прищуривание по очереди': 'Mrużenie oczu na zmianę',
  'Прищурьте правый глаз': 'Zmruż prawe oko',
  'Прищурьте левый глаз': 'Zmruż lewe oko',
  'Слегка прищурьте сначала один глаз, затем другой.': 'Lekko zmruż najpierw jedno oko, potem drugie.',
  'Небольшое движение — это уже хорошо.': 'Nawet mały ruch to już dobrze.',

  'Движение носом': 'Ruchy nosem',
  'Сморщите нос': 'Zmarszcz nos',
  'Сморщите нос, как при неприятном запахе, или попробуйте раздуть крылья носа.':
    'Zmarszcz nos jak przy nieprzyjemnym zapachu albo spróbuj rozszerzyć nozdrza.',

  'Улыбка с закрытым ртом': 'Uśmiech z zamkniętymi ustami',
  'Улыбнитесь, губы сомкнуты': 'Uśmiechnij się, usta zamknięte',
  'Слегка растяните уголки губ в стороны, рот закрыт.': 'Lekko rozciągnij kąciki ust na boki, usta zamknięte.',
  'Пальцем на ослабленной стороне можно помочь сформировать симметричную улыбку.':
    'Palcem po słabszej stronie możesz pomóc uformować symetryczny uśmiech.',

  'Губы трубочкой': 'Usta w dzióbek',
  'Вытяните губы вперёд трубочкой, затем расслабьте.': 'Wysuń usta do przodu w dzióbek, potem rozluźnij.',
  'Зубы не сжимайте.': 'Nie zaciskaj zębów.',

  'Перекатывание воздуха': 'Przetaczanie powietrza',
  'Воздух — в правую щёку': 'Powietrze — do prawego policzka',
  'Воздух — в левую щёку': 'Powietrze — do lewego policzka',
  'Выдохните, отдохните': 'Wydech, odpocznij',
  'Наберите немного воздуха в рот и мягко перекатывайте его из одной щеки в другую.':
    'Nabierz trochę powietrza do ust i delikatnie przetaczaj je z jednego policzka do drugiego.',
  'Следите, чтобы воздух не выходил через ослабленный уголок губ. При необходимости придерживайте его пальцем.':
    'Uważaj, żeby powietrze nie uciekało przez słabszy kącik ust. W razie potrzeby przytrzymaj go palcem.',

  'Гласные звуки': 'Samogłoski',
  'Звук «О»': 'Głoska «O»',
  'Звук «У»': 'Głoska «U»',
  'Звук «И»': 'Głoska «I»',
  'Звук «Э»': 'Głoska «E»',
  'Звук «А»': 'Głoska «A»',
  'Губы расслаблены': 'Usta rozluźnione',
  'Чётко и плавно произносите гласные, активно артикулируя: О, У, И, Э, А.':
    'Wymawiaj samogłoski wyraźnie i płynnie, aktywnie pracując ustami: O, U, I, E, A.',
};
