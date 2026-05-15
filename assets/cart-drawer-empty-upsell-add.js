import { CartAddEvent, CartErrorEvent } from '@theme/events';

/** Matches upsell form in cart drawer (Shopify {% form %} may not preserve arbitrary data-*). */
const FORM_SELECTOR = 'form.cart-drawer-empty-upsell__form';

/**
 * Same-origin cart.js (markets / locale prefix live on Shopify.routes.root).
 * @returns {string}
 */
function getCartJsUrl() {
  const shopify = /** @type {any} */ (typeof Shopify !== 'undefined' ? Shopify : {});
  const root = shopify.routes?.root != null ? String(shopify.routes.root) : '/';
  const normalized = root.endsWith('/') ? root : `${root}/`;
  return `${normalized}cart.js`;
}

/**
 * Cart add URL: same source as `assets/product-form.js` (`Theme.routes.cart_add_url`).
 * @param {HTMLFormElement} form
 * @returns {string}
 */
function getCartAddUrl(form) {
  if (typeof Theme !== 'undefined' && Theme.routes?.cart_add_url) {
    return Theme.routes.cart_add_url;
  }
  const fromAncestor = form.closest('[data-cart-add-url]')?.getAttribute('data-cart-add-url')?.trim();
  if (fromAncestor) return fromAncestor;
  const fromForm = form.getAttribute('data-cart-add-url')?.trim();
  if (fromForm) return fromForm;
  const action = form.getAttribute('action')?.split('?')[0];
  if (action && /\/cart\/add/i.test(action)) {
    const base = action.replace(/\.js$/i, '').replace(/\/$/, '');
    return `${base}.js`;
  }
  return '';
}

/**
 * Use the preview origin for Cart AJAX during `shopify theme dev`.
 * @param {string} url
 * @returns {string}
 */
function cartAddUrlForFetch(url) {
  if (!url) return url;
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  try {
    const parsed = new URL(trimmed, window.location.href);
    if (parsed.origin === window.location.origin) {
      return trimmed.startsWith('/') ? trimmed : `${parsed.pathname}${parsed.search}`;
    }
    if (/\.myshopify\.com$/i.test(parsed.hostname) || /\.shopifypreview\.com$/i.test(parsed.hostname)) {
      return `${parsed.pathname}${parsed.search}`;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

/**
 * Same fly pattern as `assets/sticky-add-to-cart.js` (`fly-to-cart--sticky` + upsell image).
 * @param {HTMLFormElement} form
 */
async function playDrawerUpsellFlyToCart(form) {
  const root = form.closest('.cart-drawer-empty-upsell');
  const cartIcon = document.querySelector('.header-actions__cart-icon');
  const imgEl = root?.querySelector('img.cart-drawer-empty-upsell__img');
  const img = imgEl instanceof HTMLImageElement ? imgEl : null;

  if (!cartIcon || !img?.src) return;

  await Promise.race([
    customElements.whenDefined('fly-to-cart'),
    new Promise((r) => setTimeout(r, 2000)),
  ]).catch(() => {});

  if (!customElements.get('fly-to-cart')) return;

  const flyToCartElement = /** @type {HTMLElement & { source: Element; destination: Element; useSourceSize: string }} */ (
    document.createElement('fly-to-cart')
  );
  flyToCartElement.classList.add('fly-to-cart--sticky');
  flyToCartElement.style.setProperty('background-image', `url(${img.currentSrc || img.src})`);
  flyToCartElement.useSourceSize = 'true';
  flyToCartElement.source = img;
  flyToCartElement.destination = cartIcon;
  document.body.appendChild(flyToCartElement);
}

/**
 * One delegated listener for the empty-drawer upsell form (header has no PDP product-form to puppet).
 */
function bindCartDrawerUpsellSubmit() {
  if (/** @type {any} */ (globalThis).__hairScriptsCartDrawerUpsellSubmitBound) return;
  /** @type {any} */ (globalThis).__hairScriptsCartDrawerUpsellSubmitBound = true;

  document.addEventListener(
    'submit',
    async (event) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!form?.matches(FORM_SELECTOR)) return;

      const variantInput = /** @type {HTMLInputElement | null} */ (form.querySelector('input[name="id"]'));
      if (!variantInput?.value || variantInput.disabled) return;

      const cartAddUrl = getCartAddUrl(form);
      if (!cartAddUrl) {
        console.warn('cart-drawer-upsell: missing cart add URL (data-cart-add-url / Theme.routes)');
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      const submitter = event.submitter instanceof HTMLButtonElement ? event.submitter : null;
      const toDisable = submitter || form.querySelector('button[type="submit"]');
      if (toDisable instanceof HTMLButtonElement) toDisable.disabled = true;

      const cartItemsComponents = document.querySelectorAll('cart-items-component');
      /** @type {string[]} */
      const sectionIds = [];
      cartItemsComponents.forEach((item) => {
        if (item instanceof HTMLElement && item.dataset.sectionId) {
          sectionIds.push(item.dataset.sectionId);
        }
      });

      const qtyInput = /** @type {HTMLInputElement | null} */ (form.querySelector('input[name="quantity"]'));
      const quantity = Math.max(1, Number(qtyInput?.value) || 1);
      const variantId = variantInput.value;

      /** @type {{ items: Array<{ id: number; quantity: number }>; sections?: string }} */
      const payload = {
        items: [{ id: Number(variantId), quantity }],
      };
      const sectionsParam = [...new Set(sectionIds)].join(',');
      if (sectionsParam) payload.sections = sectionsParam;

      const productIdRaw = form.closest('[data-cart-drawer-upsell-product-id]')?.getAttribute('data-cart-drawer-upsell-product-id');
      const productId = productIdRaw ?? undefined;

      try {
        // JSON POST matches `product-form.js` batch add (multipart FormData can misbehave with some theme-dev proxies).
        const response = await fetch(cartAddUrlForFetch(cartAddUrl), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });

        let data;
        try {
          data = await response.json();
        } catch {
          console.error('cart-drawer-upsell add: expected JSON', response.status);
          return;
        }

        if (data.status) {
          document.dispatchEvent(
            new CartErrorEvent(form.getAttribute('id') || '', data.message, data.description, data.errors)
          );
          return;
        }

        await playDrawerUpsellFlyToCart(form);

        let cart = null;
        try {
          const cartRes = await fetch(getCartJsUrl());
          cart = await cartRes.json();
        } catch (_) {
          // cart add succeeded; cart.js fetch is optional for event payload
        }

        const hasCartCount = cart && typeof cart.item_count === 'number';

        document.dispatchEvent(
          new CartAddEvent(cart ?? undefined, String(variantId), {
            source: hasCartCount ? 'cart-drawer-upsell' : 'product-form-component',
            itemCount: hasCartCount ? cart.item_count : quantity,
            productId,
            sections: data.sections,
          })
        );
      } catch (error) {
        console.error(error);
      } finally {
        if (toDisable instanceof HTMLButtonElement) toDisable.disabled = false;
      }
    },
    true
  );
}

bindCartDrawerUpsellSubmit();
