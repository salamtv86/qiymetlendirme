# Aylıq qiymətləndirmə protokolu

Müəllimlər öz login və şifrələri ilə daxil olur. Hər şagirdə beş göstərici üzrə 1–5 bal verirlər:

- akademik nailiyyətlər
- dərsə hazırlıq
- dərsdə iştirak
- nizam-intizam
- davamiyyət

Psixoloq öz bölməsində qeyd yazır. Sinif rəhbəri və admin hər şagird üçün PDF protokol çıxarır. Protokolda bütün fənlər üzrə qiymətlər, ədədi orta bal, psixoloq qeydləri və valideyn ilə məktəb rəhbərinin imza yerləri olur.

Sistemin üç hissəsi var:

- **Google Cədvəl** — bütün məlumatlar burada saxlanılır: şagirdlər, müəllimlər, qiymətlər, qeydlər.
- **Apps Script** — cədvələ bağlı server. Login və şifrəni yoxlayır, qiymətləri cədvələ yazır.
- **GitHub Pages** — müəllimlərin açdığı səhifə (`https://istifadeci-adi.github.io/qiymetlendirme/`).

## Fayllar

| Fayl | Nə üçündür |
|---|---|
| `index.html` | GitHub Pages səhifəsi |
| `config.js` | Apps Script linki (artıq yazılıb) |
| `apps-script/Code.gs` | Server kodu (Google Cədvələ bağlı Apps Script) |
| `apps-script/appsscript.json` | Layihə ayarları (yalnız `clasp` işlədənlər üçün) |

## Qurulma

Qurulma təxminən 15 dəqiqə çəkir və kompüterdə edilməlidir.

### 1. Google Cədvəl yaradın

[sheets.new](https://sheets.new) ünvanında boş cədvəl açın və ona ad verin, məsələn «Aylıq qiymətləndirmə».

### 2. Server kodunu əlavə edin

1. Cədvəldə **Extensions → Apps Script** seçin (bu menyu «Help / Kömək» menyusundan əvvəl gəlir).
2. Açılan `Code.gs` faylının içini silin və bu paketdəki `apps-script/Code.gs` faylının məzmununu yapışdırın.
3. Yadda saxlayın (Ctrl+S).

İstəyə bağlı: sistemin GitHub olmadan, birbaşa Apps Script linkində də açılmasını istəyirsinizsə, sol tərəfdə **+ → HTML** ilə `Index` adlı fayl yaradın (`.html` özü əlavə olunur) və içinə bu paketdəki `index.html` faylının məzmununu yapışdırın.

### 3. Vərəqləri yaradın

1. Cədvəl səhifəsinə qayıdın və səhifəni yeniləyin. Yuxarıda **Qiymətləndirmə** menyusu görünəcək.
2. **Qiymətləndirmə → Sistemi qur** seçin.
3. Google icazə istəyəcək: **Continue → Advanced → Go to … (unsafe) → Allow**. Bu xəbərdarlıq normaldır, çünki skript sizin öz cədvəlinizdədir.
4. Vərəqlər yaranır və ekranda **admin** login-i ilə şifrəsi görünür. Onları yadda saxlayın. Bu məlumat «İstifadəçilər» vərəqində də yazılıdır.

### 4. Məlumatları doldurun

- **Ayarlar** — məktəbin adı və məktəb rəhbərinin adı. İkisi də protokolda çap olunur.
- **Fənlər** — hər sətirdə bir fənn. Protokola ən çox 8 fənn yaxşı sığır.
- **Şagirdlər** — «Sinif» (məs. `9A`) və «Soyadı, adı». ID sütunu özü dolur, onu dəyişməyin.
- **İstifadəçilər** — hər müəllim üçün bir sətir (aşağıdakı cədvələ baxın).

### 5. Veb tətbiqi yayımlayın

1. Apps Script redaktorunda **Deploy → New deployment** seçin.
2. ⚙ işarəsindən **Web app** seçin.
3. **Execute as: Me** və **Who has access: Anyone** təyin edin.
4. **Deploy** düyməsini basın.
5. Görünən **Web app URL** linkini kopyalayın. Link `/exec` ilə bitir.

Bu link sistemin serveridir. Brauzerdə açanda «Server işləyir» yazısı görünməlidir. `Index` faylını da əlavə etmisinizsə, bu linkdə sistemin özü açılır və GitHub-u qurmadan müəllimlərə elə bu linki də verə bilərsiniz.

### 6. GitHub Pages-də yerləşdirin

1. github.com-da yeni **Public** repo yaradın, məsələn `qiymetlendirme`.
2. **Add file → Upload files** ilə paketdəki bütün faylları yükləyin. `apps-script` qovluğunu da yükləyin, kodun ehtiyat nüsxəsi orada qalır.
3. `config.js` faylında 5-ci addımdakı link artıq yazılıb. Gələcəkdə **New deployment** ilə yeni link yaratsanız, repoda bu faylı açın, qələm işarəsini basın, linki dəyişin və **Commit** edin.
4. **Settings → Pages** bölməsində **Source: Deploy from a branch** seçin. **Branch** olaraq `main` və `/ (root)` seçib **Save** basın.
5. 1–2 dəqiqə sonra səhifə `https://istifadeci-adiniz.github.io/qiymetlendirme/` ünvanında açılacaq.

Repo açıq (public) olsa da, şagird məlumatları orada saxlanılmır. Bütün məlumatlar yalnız sizin Google Cədvəlinizdə qalır, server isə hər sorğuda login yoxlayır.

### 7. Müəllimlərə göndərin

Hər müəllimə səhifənin linkini, onun login-ini və şifrəsini göndərin.

## İstifadəçilər və rollar

«İstifadəçilər» vərəqinin sütunları: **Login · Şifrə · Ad, soyad · Rol · Fənlər · Dərs dediyi siniflər · Rəhbəri olduğu sinif · Aktiv**

| Rol | Nə edə bilir | Hansı sütunlar istifadə olunur |
|---|---|---|
| `müəllim` | Öz fənləri və sinifləri üzrə qiymət yazır | Fənlər, Dərs dediyi siniflər |
| `psixoloq` | Psixoloq qeydlərini yazır | Dərs dediyi siniflər (boş qalsa, bütün siniflər) |
| `sinif rəhbəri` | Sinfinin protokollarını görür, PDF çıxarır | Rəhbəri olduğu sinif |
| `admin` | Hər şeyi görür və edir | — |

- Bir nəfərə bir neçə rol verilə bilər: `müəllim, sinif rəhbəri`.
- Fənlər və siniflər vergüllə yazılır. Hamısı üçün `*` yazın.
- «Aktiv» sütununda `Xeyr` yazsanız, həmin şəxs daxil ola bilmir.

Nümunə:

| Login | Şifrə | Ad, soyad | Rol | Fənlər | Dərs dediyi siniflər | Rəhbəri olduğu sinif | Aktiv |
|---|---|---|---|---|---|---|---|
| nermin | 4821 | Kərimova Nərmin | müəllim, sinif rəhbəri | Riyaziyyat | 9A, 9B, 10A | 9A | Bəli |
| aynur | 7310 | Əliyeva Aynur | psixoloq | | | | Bəli |

## Gündəlik istifadə

- **Qiymətlər** hər ay üçün ayrıca vərəqdə saxlanılır, məsələn «Qiymətlər 2026-10». Vərəq ilk qiymət yazılanda özü yaranır.
- **Psixoloq qeydləri** eyni adlı vərəqdə saxlanılır.
- **Şifrəni dəyişmək** həmin istifadəçini bütün cihazlardan çıxarır.
- **Hamını çıxarmaq** üçün menyudan **Qiymətləndirmə → Bütün istifadəçiləri sistemdən çıxar** seçin.
- **Fənnin adını dəyişsəniz**, köhnə adla yazılmış qiymətlər protokolda görünməz. Belə halda adı aylıq vərəqlərdə də dəyişin (Ctrl+H ilə axtar-dəyiş).
- **iPhone-da** PDF yeni pəncərədə açılır. Oradan **Paylaş → Fayllarda saxla** ilə yaddaşa yazın.

## Kodu yeniləmək

`Code.gs` və ya `Index.html` dəyişəndə **Deploy → Manage deployments** bölməsinə keçin. Qələm işarəsini basın, **Version: New version** seçin və **Deploy** basın.

Bu yolla link dəyişmir. **New deployment** isə yeni link yaradır və o halda `config.js`-i də yeniləmək lazım gəlir.

## Problem olarsa

| Görünən mesaj | Səbəb və həll |
|---|---|
| «Sistem hələ qoşulmayıb» | `config.js` faylında link yazılmayıb. |
| «Serverə qoşulmaq alınmadı» | Deploy zamanı **Who has access: Anyone** seçilməlidir. Link `/exec` ilə bitməlidir. |
| «Sistem qurulmayıb: … vərəqi yoxdur» | Cədvəldə **Qiymətləndirmə → Sistemi qur** işə salın. |
| «Login və ya şifrə yanlışdır» | «İstifadəçilər» vərəqində login və şifrəni yoxlayın. |
| «Sizə hələ iş təyin edilməyib» | İstifadəçiyə rol, fənn və ya sinif yazılmayıb. |
| «Çox sayda uğursuz cəhd oldu» | 10 dəqiqə gözləyin. |
