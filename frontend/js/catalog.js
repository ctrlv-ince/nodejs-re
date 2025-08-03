$(function() {
  const url = 'http://localhost:4000/';
  $('#home').load('header.html');

  // Modes: 'infinite' or 'paged' (manual load more). Default now: 'paged'
  let mode = 'paged';

  function applyModeUI() {
    if (mode === 'infinite') {
      $('#btnInfinite').addClass('active');
      $('#btnPaged').removeClass('active');
      $('#loadMoreBtn').hide();
      // Ensure we only bind the scroll handler once
      $(window).off('scroll.catalogInfinite').on('scroll.catalogInfinite', function() {
        if (mode !== 'infinite') return;
        if ($(window).scrollTop() + $(window).height() > $(document).height() - 200) {
          fetchAndRenderBatch();
        }
      });
    } else {
      $('#btnPaged').addClass('active');
      $('#btnInfinite').removeClass('active');
      $('#loadMoreBtn').show();
      // Disable infinite scroll while in paged mode
      $(window).off('scroll.catalogInfinite');
    }
  }

  $(document).on('click', '#btnInfinite', function () {
    mode = 'infinite';
    applyModeUI();
  });
  $(document).on('click', '#btnPaged', function () {
    mode = 'paged';
    applyModeUI();
  });

  function renderStars(rating) {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    const full = Math.floor(r);
    const half = r - full >= 0.25 && r - full < 0.75 ? 1 : 0;
    const adjFull = half ? full : Math.round(r);
    const empties = 5 - (adjFull + half);
    const fullStars = '★'.repeat(adjFull);
    const halfStar = half ? '☆' : '';
    const emptyStars = '☆'.repeat(empties);
    return `<span style="color:#f1c40f;font-size:13px;letter-spacing:1px;">${fullStars}${halfStar}${emptyStars}</span>`;
  }

  let page = 0;
  const pageSize = 12;
  let loading = false;
  let allLoaded = false;

  function fetchAndRenderBatch() {
    if (loading || allLoaded) return;
    loading = true;
    $('#loading').show();

    // Snapshot current page index to avoid duplicate renders if state changes mid-flight
    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;

    $.get(`${url}api/v1/items`, function(data) {
      const rows = Array.isArray(data.rows) ? data.rows : [];

      // De-duplicate any accidental duplicates from the backend by item_id
      const seen = new Set();
      const deduped = [];
      for (const r of rows) {
        const key = String(r.item_id);
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(r);
      }

      // Slice based on the deduped array
      const items = deduped.slice(startIndex, endIndex);

      // If no items for this slice, mark as all loaded and stop
      if (!items.length) {
        allLoaded = true;
        $('#loading').hide();
        loading = false;
        return;
      }

      let html = '';
      const batchIds = [];

      items.forEach(function(value) {
        const imgSrc = value.image_path ? (`${url}${value.image_path.startsWith('/') ? value.image_path.slice(1) : value.image_path}`) : 'https://via.placeholder.com/300x200?text=No+Image';
        batchIds.push(value.item_id);
        html += `<div class="col-md-6 mb-4" data-item-id="${value.item_id}">
          <div class="card h-100">
            <img src="${imgSrc}" class="card-img-top" alt="${value.item_name}">
            <div class="card-body">
              <h5 class="card-title">${value.item_name}</h5>
              <p class="card-text">${value.item_description}</p>
              <p class="card-text mb-1">₱ ${value.price}</p>
              <div class="small" id="rating-${value.item_id}"><span class="text-muted">Loading rating…</span></div>
              <a href="item.html?id=${value.item_id}" class="btn btn-outline-primary btn-block mt-2">View</a>
            </div>
          </div>
        </div>`;
      });

      // Advance the page BEFORE appending to prevent accidental re-entry duplication
      page++;

      // Extra guard: do not append if a card for the same item_id already exists (in case of race conditions)
      const $frag = $(html);
      $frag.each(function(){
        const id = $(this).attr('data-item-id');
        if (id && $(`#catalogGrid [data-item-id="${id}"]`).length) {
          $(this).remove();
        }
      });
      $('#catalogGrid').append($frag);

      // Ratings summary: try bulk, then fallback to per-item
      if (batchIds.length) {
        const idsParam = batchIds.join(',');
        $.get(`${url}api/v1/reviews/summary`, { ids: idsParam })
          .done(function(sdata){
            const rows = (sdata && (sdata.rows || sdata.result || sdata)) || [];
            const byId = {};
            (Array.isArray(rows) ? rows : []).forEach(r => {
              byId[String(r.item_id)] = { avg: Number(r.avg || r.average || 0), count: Number(r.count || r.total || 0) };
            });
            batchIds.forEach(idVal => {
              const s = byId[String(idVal)];
              if (s && s.count > 0) {
                $(`#rating-${idVal}`).html(`${renderStars(s.avg)} <span class="ml-1">${s.avg.toFixed(1)} (${s.count})</span>`);
              } else {
                $(`#rating-${idVal}`).html('<span class="text-muted">No reviews yet</span>');
              }
            });
          })
          .fail(function(){
            batchIds.forEach(function(idVal){
              $.get(`${url}api/v1/reviews/${idVal}`)
                .done(function(rdata){
                  const rows = (rdata && (rdata.rows || rdata.result || rdata)) || [];
                  if (!Array.isArray(rows) || rows.length === 0) {
                    $(`#rating-${idVal}`).html('<span class="text-muted">No reviews yet</span>');
                    return;
                  }
                  const ratings = rows.map(r => Number(r.rating || r.stars || 0)).filter(n => !isNaN(n));
                  const avg = ratings.length ? (ratings.reduce((a,b)=>a+b,0) / ratings.length) : 0;
                  $(`#rating-${idVal}`).html(`${renderStars(avg)} <span class="ml-1">${avg.toFixed(1)} (${rows.length})</span>`);
                })
                .fail(function(){
                  $(`#rating-${idVal}`).html('<span class="text-muted">Rating unavailable</span>');
                });
            });
          });
      }

      loading = false;
      $('#loading').hide();
    }).fail(function(){
      loading = false;
      $('#loading').hide();
    });
  }

  // Initial load (first page)
  fetchAndRenderBatch();
  // Apply UI and correct handlers per mode
  applyModeUI();

  // Paged "Load more" button
  $(document).on('click', '#loadMoreBtn', function() {
    if (mode !== 'paged') return;
    fetchAndRenderBatch();
  });
});