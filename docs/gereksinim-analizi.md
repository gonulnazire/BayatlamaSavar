# BayatlamaSavar - Proje Gereksinim Analizi ve Teknik Dokümanı

## 1. Proje Genel Bakış
* **Proje Adı:** BayatlamaSavar
* **Amaç:** Buzdolabında veya mutfakta kapağı açılan ya da ambalajı açıldıktan sonra raf ömrü kısalan gıda ürünlerinin (süt, yoğurt, salça, soslar vb.) takip edilmesini sağlayarak gıda israfını önlemek ve kullanıcıyı zamanında uyarmak.
* **Hedef Kitle:** Evde yemek yapanlar, ev arkadaşları, tek başına yaşayanlar ve gıda israfından kaçınmak isteyen herkes.
* **Geliştirme Süresi:** 48 Saat (MVP - Minimum Viable Product)

---

## 2. Teknoloji Yığını (Tech Stack)
* **Arayüz (Frontend):** Next.js (App Router) + Tailwind CSS (Modern, mobil uyumlu ve şık koyu tema tasarımı)
* **Durum ve Veri Yönetimi (State & Storage):** Tarayıcı tabanlı `localStorage` veya hafif bir React State yapısı (2 günlük sürede veritabanı karmaşasından kaçınmak için).
* **İkonlar & Bileşenler:** Lucide React (ikonlar için)

---

## 3. Fonksiyonel Gereksinimler (Functional Requirements)

### 3.1. Ürün Ekleme (Create)
* Kullanıcı yeni açtığı bir gıdayı sisteme hızlıca ekleyebilmelidir.
* **Form Alanları:**
  * Ürün Adı (Örn: Sütaş Süt, Pınar Labne)
  * Kategori (Süt Ürünü, Sos/Konserve, Et/Şarküteri, Diğer)
  * Açılış Tarihi (Varsayılan olarak otomatik bugünün tarihi gelmelidir)
  * Raf Ömrü / Tüketim Süresi (Gün cinsinden sayısal değer, örn: 3 gün, 7 gün)

### 3.2. Akıllı Liste ve Durum Takibi (Read & Process)
* Eklenen tüm ürünler ana sayfada bir kart listesi şeklinde görünmelidir.
* Sistem, her ürün için şu formülü arka planda çalıştırmalıdır: 
  $$\text{Kalan Gün} = (\text{Açılış Tarihi} + \text{Raf Ömrü}) - \text{Bugünün Tarihi}$$
* **Dinamik Renk Kodlaması (UX/UI Kriteri):**
  * **Yeşil (Güvenli):** Kalan gün $\ge 3$ gün ise.
  * **Sarı (Dikkat / Yaklaşıyor):** Kalan gün $1$ veya $2$ gün ise.
  * **Kırmızı (Süresi Doldu / Çöpe At):** Kalan gün $\le 0$ gün ise.

### 3.3. Ürün Silme / Güncelleme (Delete)
* Kullanıcı ürünü tükettiğinde veya bozulduğu için çöpe attığında kart üzerindeki "Tükettim / Sil" butonuna basarak ürünü listeden kalıcı olarak kaldırabilmelidir.

---

## 4. Fonksiyonel Olmayan Gereksinimler (Non-Functional Requirements)
* **Kullanılabilirlik (Usability):** Arayüz aşırı sade ve hızlı olmalıdır. Kullanıcı bir ürünü eklemek için 5 saniyeden fazla vakit harcamamalıdır.
* **Performans:** Sayfa yüklenme süresi anlık olmalı, istemci tarafında (Client-side) hızlıca render edilmelidir.
* **Tasarım:** Göz yormayan, modern ve şık bir **Dark Mode (Koyu Tema)** ağırlıklı arayüz tasarımı sunulmalıdır.

---

## 5. Gelecek Faz Geliştirmeleri (Post-MVP)
* Gerçek bir veritabanı (Supabase / PostgreSQL) entegrasyonu.
* Kullanıcı girişi (Authentication) ile çoklu ev arkadaşı desteği.
* E-posta veya tarayıcı bildirimleri (Push Notification) ile son günü gelen ürünler için uyarı atılması.