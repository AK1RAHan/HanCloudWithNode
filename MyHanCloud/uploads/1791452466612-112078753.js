// JavaScript untuk Aktifkan Scroll Kanan-Kiri Pakai Wheel Mouse
const scrollContainers = document.querySelectorAll('.horizontal-scroll-container');

scrollContainers.forEach((container) => {
  container.addEventListener('wheel', (evt) => {
    // Geser ke kanan/kiri sesuai putaran scroll mouse
    if (Math.abs(evt.deltaY) > Math.abs(evt.deltaX)) {
      evt.preventDefault();
      container.scrollLeft += evt.deltaY;
    }
  }, { passive: false });
});
