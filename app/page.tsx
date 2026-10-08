"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { readGuestCart, writeGuestCart, clearGuestCart, saveAccountCart, syncCartOnLogin, type CartItem } from "@/lib/cart";
import {
  Search,
  User,
  Heart,
  ShoppingCart,
  ArrowRight,
  Star,
  Truck,
  RotateCcw,
  ShieldCheck,
  Headset,
  ShoppingBag,
  Store,
  ImagePlus,
  Mail,
  Phone,
} from "lucide-react";

const FacebookIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M22 12.06C22 6.51 17.52 2 12 2S2 6.51 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.91h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94Z" />
  </svg>
);
const InstagramIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
  </svg>
);
const TwitterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.9 2H22l-7.6 8.7L23.3 22h-6.9l-5.4-6.9L4.8 22H1.7l8.1-9.3L1 2h7.1l4.9 6.3L18.9 2Zm-1.2 18h1.9L7.4 4H5.4l12.3 16Z" />
  </svg>
);

const FONT_STACK = "'Aeonik', ui-sans-serif, system-ui, -apple-system, sans-serif";

// Separate from the guest cart key ("olaservir_cart") used in @/lib/cart.
// This is only a one-way handoff to the checkout page, so it must never
// share a key with the guest cart or it gets merged (doubled) on return.
const CHECKOUT_CART_KEY = "olaservir_checkout_cart";

// Each nav link scrolls to a section on this page. `target: null` = top of page.
const NAV_LINKS: { label: string; target: string | null }[] = [
  { label: "Home", target: null },
  { label: "Shop", target: "available-products" },
  { label: "New Arrivals", target: "new-arrivals" },
  { label: "About Us", target: "about-us" },
];

const TRUST_ITEMS = [
  { icon: Truck, title: "Bolt Delivery", subtitle: "Fast & reliable delivery" },
  { icon: RotateCcw, title: "Easy Returns", subtitle: "7-day return policy" },
  { icon: ShieldCheck, title: "Secure Checkout", subtitle: "100% secure payment" },
  { icon: Headset, title: "24/7 Support", subtitle: "We're here to help" },
];

const CATEGORIES = [
  { name: "Shirts", count: "70+ items" },
  { name: "Trousers", count: "60+ items" },
  { name: "Shoes", count: "45+ items" },
  { name: "Belts", count: "30+ items" },
];

const PROMO_BANNERS = [
  { title: "Linen Collection", subtitle: "Lightweight. Breathable. Perfect for every season.", bg: "from-[#E7E5E1] to-[#E2F4FF]" },
  
];

const slugify = (s: string) => s.toLowerCase().trim().replace(/\s+/g, "-");

type LiveProduct = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  original_price: number | null;
  images: string[];
  rating: number;
  reviews_count: number;
  created_at: string;
};

type SearchItem = {
  id: string;
  name: string;
  price?: string;
  kind: "Product" | "New Arrival" | "Category";
};

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SELLER_EMAIL = process.env.NEXT_PUBLIC_SELLER_EMAIL ?? "";
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";
const HARDCODED_ADMIN_EMAILS = ["olamideakinjare@gmail.com"];

const isAdminEmail = (email: string) => {
  const normalized = email.trim().toLowerCase();
  if (ADMIN_EMAIL && normalized === ADMIN_EMAIL.toLowerCase()) return true;
  return HARDCODED_ADMIN_EMAILS.includes(normalized);
};

type UserRole = "buyer" | "seller";
type AppUser = { id: string; name: string; email: string; role: UserRole };

const roleForEmail = (email: string): UserRole =>
  email.toLowerCase() === SELLER_EMAIL.toLowerCase() ? "seller" : "buyer";

const HERO_SLOTS = ["hero-slide-1", "hero-slide-2", "hero-slide-3"];
const HERO_ROTATE_MS = 3200;

// A product counts as "new" if it was created within this many milliseconds.
const NEW_ARRIVAL_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export default function Home() {
  const [active, setActive] = useState<string>("Home");
  const [underline, setUnderline] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  const [introVisible, setIntroVisible] = useState(false);
  const [introMounted, setIntroMounted] = useState(false);
  const [locationChoice, setLocationChoice] = useState<"ask" | "yes" | "no">("ask");

  useEffect(() => {
    // Only play the splash once per browser tab — if it already ran earlier
    // in this session (e.g. they're just navigating back to the homepage),
    // skip it entirely instead of replaying it.
    const alreadyShown = sessionStorage.getItem("olaservir_intro_shown");
    if (alreadyShown) return;

    sessionStorage.setItem("olaservir_intro_shown", "1");
    setIntroVisible(true);
    setIntroMounted(true);

    const fadeTimer = setTimeout(() => setIntroVisible(false), 2400);
    const unmountTimer = setTimeout(() => setIntroMounted(false), 3000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  const [liveProducts, setLiveProducts] = useState<LiveProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setLiveProducts(data as LiveProduct[]);
        setProductsLoading(false);
      });
  }, []);

  // When someone clicks a category card, this holds that category's name
  // (e.g. "Shirts") and Available Products below is filtered down to just
  // that category. null = show everything, the normal state.
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const goToCategory = (name: string) => {
    setCategoryFilter(name);
    document.getElementById("available-products")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Available Products = every item, unless a category filter is active.
  // New Arrivals = only items created in the last 24 hours (they also still
  // show up in Available Products — being "new" doesn't remove them from
  // the full catalog, it's just an extra highlight).
  const availableProducts = useMemo(() => {
    if (!categoryFilter) return liveProducts;
    return liveProducts.filter((p) => p.category.toLowerCase() === categoryFilter.toLowerCase());
  }, [liveProducts, categoryFilter]);
  const newArrivals = useMemo(() => {
    const cutoff = Date.now() - NEW_ARRIVAL_WINDOW_MS;
    return liveProducts.filter((p) => new Date(p.created_at).getTime() >= cutoff);
  }, [liveProducts]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState<boolean>(false);
  const [cartLoaded, setCartLoaded] = useState(false);

  const addToCart = (product: { id: string; name: string; price: string }) => {
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.id === product.id);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, qty: 1 }];
    });
    setCartOpen(true);
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.qty * Number(item.price.replace(/[^\d]/g, "")), 0);

  type WishlistItem = { id: string; name: string; price: string };
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [wishlistOpen, setWishlistOpen] = useState<boolean>(false);

  const isWishlisted = (id: string) => wishlist.some((item) => item.id === id);

  const toggleWishlist = (product: { id: string; name: string; price: string }) => {
    setWishlist((prev) =>
      prev.some((item) => item.id === product.id)
        ? prev.filter((item) => item.id !== product.id)
        : [...prev, { id: product.id, name: product.name, price: product.price }]
    );
  };

  type ImageMap = Record<string, string>;
  const [categoryImages, setCategoryImages] = useState<ImageMap>({
    shirts: "/images/White%20Shirt%206.jpg",
    trousers: "/images/Black%20Trouser%201.jpg",
    shoes: "/images/Black%20Shoe%203.jpg",
    belts: "/images/Black%20Belt%20A3.jpg",
  });
  const [heroImages, setHeroImages] = useState<ImageMap>({
    "hero-slide-1": "/images/Mixed%20Trousers%201.jpg",
    "hero-slide-2": "/images/Brown%20Shoe%201.jpg",
    "hero-slide-3": "/images/Black%20Belt%20A3.jpg",
  });
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    key: string,
    setter: React.Dispatch<React.SetStateAction<ImageMap>>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setter((prev) => ({ ...prev, [key]: reader.result as string }));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const [heroSlide, setHeroSlide] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setHeroSlide((prev) => (prev + 1) % HERO_SLOTS.length);
    }, HERO_ROTATE_MS);
    return () => clearInterval(interval);
  }, []);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchOpen, setSearchOpen] = useState<boolean>(false);

  const searchItems: SearchItem[] = useMemo(() => {
    const categoryItems: SearchItem[] = CATEGORIES.map((c) => ({
      id: `cat-${slugify(c.name)}`,
      name: c.name,
      kind: "Category",
    }));

    const newArrivalItems: SearchItem[] = newArrivals.map((p) => ({
      id: `new-${p.slug}`,
      name: p.name,
      price: `₦${p.price.toLocaleString()}`,
      kind: "New Arrival",
    }));

    const productItems: SearchItem[] = availableProducts.map((p) => ({
      id: `product-${p.slug}`,
      name: p.name,
      price: `₦${p.price.toLocaleString()}`,
      kind: "Product",
    }));

    return [...categoryItems, ...newArrivalItems, ...productItems];
  }, [newArrivals, availableProducts]);

  const searchResults =
    searchQuery.trim().length === 0
      ? []
      : searchItems.filter((item) => item.name.toLowerCase().includes(searchQuery.trim().toLowerCase())).slice(0, 6);

  const goToResult = (id: string) => {
    setSearchOpen(false);
    setSearchQuery("");
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-[#172236]");
      setTimeout(() => el.classList.remove("ring-2", "ring-[#172236]"), 1500);
    }
  };

  type AuthView = "store" | "signup" | "login" | "role-select" | "verify" | "forgot" | "reset";
  const [authView, setAuthView] = useState<AuthView>("store");
  const [accountOpen, setAccountOpen] = useState<boolean>(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [roleError, setRoleError] = useState("");

  // Email-code (OTP) flows: verifying a new account, and resetting a password.
  const [pendingEmail, setPendingEmail] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [authInfo, setAuthInfo] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const [postLoginRedirect, setPostLoginRedirect] = useState<null | "checkout">(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setUser({
          id: session.user.id,
          name: session.user.user_metadata?.full_name ?? session.user.email.split("@")[0],
          email: session.user.email,
          role: roleForEmail(session.user.email),
        });
      }
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setUser({
          id: session.user.id,
          name: session.user.user_metadata?.full_name ?? session.user.email.split("@")[0],
          email: session.user.email,
          role: roleForEmail(session.user.email),
        });
      } else {
        setUser(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Load the right cart once we know whether someone's logged in: their
  // saved account cart if so (merging in anything added as a guest just
  // before they logged in), or this browser's guest cart if not. This has
  // to come AFTER the auth effect above, since it depends on `user` and
  // `authLoading` having already been declared.
  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    (async () => {
      const items = user ? await syncCartOnLogin(supabase, user.id) : readGuestCart();
      if (!cancelled) {
        setCart(items);
        setCartLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  // Keep the cart saved wherever it belongs — the signed-in shopper's
  // account in Supabase, or this browser's guest cart if nobody's logged in.
  useEffect(() => {
    if (!cartLoaded) return;
    if (user) {
      saveAccountCart(supabase, user.id, cart);
    } else {
      writeGuestCart(cart);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, cartLoaded, user?.id]);

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    if (!signupName.trim() || !signupEmail.trim() || !signupPassword) {
      setAuthError("Please fill in every field.");
      return;
    }
    if (signupPassword.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }
    if (signupPassword !== signupConfirm) {
      setAuthError("Passwords don't match.");
      return;
    }

    setAuthSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: signupEmail.trim(),
      password: signupPassword,
      options: { data: { full_name: signupName.trim() } },
    });
    setAuthSubmitting(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    setAuthError("");

    if (!data.session) {
      // Email confirmation is on: Supabase emailed a code, so ask for it.
      setPendingEmail(signupEmail.trim());
      setVerifyCode("");
      setAuthInfo("We sent a verification code to your email.");
      setResendCooldown(60);
      setAuthView("verify");
      return;
    }

    setRoleError("");
    setAuthView("role-select");
  };

  const handleVerifySignup = async (e: FormEvent) => {
    e.preventDefault();
    if (verifyCode.trim().length < 6) {
      setAuthError("Enter the code from your email.");
      return;
    }

    setAuthSubmitting(true);
    const { error } = await supabase.auth.verifyOtp({
      email: pendingEmail,
      token: verifyCode.trim(),
      type: "signup",
    });
    setAuthSubmitting(false);

    if (error) {
      setAuthError("That code is wrong or has expired. Try again or request a new one.");
      return;
    }

    setAuthError("");
    setAuthInfo("");
    setRoleError("");
    // Came from the sign-up form -> pick a role. Came from a login attempt -> straight to the store.
    setAuthView(signupEmail.trim().toLowerCase() === pendingEmail.toLowerCase() ? "role-select" : "store");
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || !pendingEmail) return;

    const { error } =
      authView === "reset"
        ? await supabase.auth.resetPasswordForEmail(pendingEmail)
        : await supabase.auth.resend({ type: "signup", email: pendingEmail });

    if (error) {
      setAuthError(error.message);
      return;
    }
    setAuthError("");
    setAuthInfo("A new code has been sent to your email.");
    setResendCooldown(60);
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) {
      setAuthError("Enter the email you signed up with.");
      return;
    }

    setAuthSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail.trim());
    setAuthSubmitting(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    setPendingEmail(loginEmail.trim());
    setResetCode("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setAuthError("");
    setAuthInfo("If that email has an account, we've sent a reset code to it.");
    setResendCooldown(60);
    setAuthView("reset");
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    if (resetCode.trim().length < 6) {
      setAuthError("Enter the code from your email.");
      return;
    }
    if (newPassword.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setAuthError("Passwords don't match.");
      return;
    }

    setAuthSubmitting(true);

    // Step 1: the code proves they own the email and signs them in briefly.
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: pendingEmail,
      token: resetCode.trim(),
      type: "recovery",
    });
    if (verifyError) {
      setAuthSubmitting(false);
      setAuthError("That code is wrong or has expired. Try again or request a new one.");
      return;
    }

    // Step 2: set the new password.
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setAuthSubmitting(false);

    if (updateError) {
      setAuthError(updateError.message);
      return;
    }

    setAuthError("");
    setAuthInfo("");
    setLoginPassword("");
    setAuthView("store");
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      setAuthError("Please enter your email and password.");
      return;
    }

    setAuthSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    setAuthSubmitting(false);

    if (error) {
      // Signed up but never entered the code: send a fresh one and take them to the code screen.
      if (/not confirmed/i.test(error.message)) {
        setPendingEmail(loginEmail.trim());
        await supabase.auth.resend({ type: "signup", email: loginEmail.trim() });
        setVerifyCode("");
        setAuthError("");
        setAuthInfo("Your email isn't verified yet. We sent you a new code.");
        setResendCooldown(60);
        setAuthView("verify");
        return;
      }
      setAuthError("Wrong email or password.");
      return;
    }

    setAuthError("");

    if (isAdminEmail(loginEmail)) {
      window.location.href = "/admin/dashboard";
      return;
    }

    setAuthView("store");

    if (postLoginRedirect === "checkout") {
      localStorage.setItem(CHECKOUT_CART_KEY, JSON.stringify(cart));
      window.location.href = "/checkout";
      return;
    }
    setPostLoginRedirect(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Clear what's on screen and in this browser so the next person who
    // uses it doesn't see this account's cart. Their account cart is still
    // safely saved in Supabase for next time they log in.
    setCart([]);
    clearGuestCart();
    localStorage.removeItem(CHECKOUT_CART_KEY);
    setAccountOpen(false);
  };

  const handleRoleChoice = (role: "buyer" | "admin") => {
    setRoleError("");

    if (role === "buyer") {
      setAuthView("store");
      return;
    }

    const email = signupEmail.trim().toLowerCase();
    if (isAdminEmail(email)) {
      window.location.href = "/admin/dashboard";
    } else {
      setRoleError("This email isn't authorized for admin access.");
    }
  };

  const handleCheckout = () => {
    if (!user) {
      setCartOpen(false);
      setPostLoginRedirect("checkout");
      setAuthError("Please log in to continue checking out.");
      setAuthView("login");
      return;
    }

    if (cart.length === 0) return;

    localStorage.setItem(CHECKOUT_CART_KEY, JSON.stringify(cart));
    setCartOpen(false);
    window.location.href = "/checkout";
  };

  const linkRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const moveUnderline = () => {
      const el = linkRefs.current[active];
      const nav = navRef.current;
      if (!el || !nav) return;

      const elRect = el.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();

      setUnderline({ left: elRect.left - navRect.left, width: elRect.width });
    };

    moveUnderline();
    window.addEventListener("resize", moveUnderline);
    return () => window.removeEventListener("resize", moveUnderline);
  }, [active]);

  const introLetters = "Olaservir".split("");

  const introOverlay = introMounted ? (
    <div
      className={`fixed inset-0 z-[100] flex h-screen w-full flex-col items-center justify-center gap-6 bg-[#172236] text-center transition-opacity ease-out ${
        introVisible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      style={{ fontFamily: FONT_STACK, transitionDuration: "700ms" }}
      aria-hidden={!introVisible}
    >
      <style>{`
        @keyframes olaservirLogoPop {
          0%   { opacity: 0; transform: scale(0.4) rotate(-8deg); }
          60%  { opacity: 1; transform: scale(1.08) rotate(2deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes olaservirLetterUp {
          0%   { opacity: 0; transform: translateY(18px); filter: blur(4px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes olaservirTagline {
          0%   { opacity: 0; letter-spacing: 0.3em; transform: translateY(6px); }
          100% { opacity: 1; letter-spacing: 0.02em; transform: translateY(0); }
        }
        .olaservir-logo-pop { animation: olaservirLogoPop 700ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .olaservir-letter { display: inline-block; animation: olaservirLetterUp 550ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .olaservir-tagline { animation: olaservirTagline 700ms ease-out both; }
      `}</style>

      <img
        src="/images/LOGO.png"
        alt="Olaservir"
        className="olaservir-logo-pop h-28 w-28 object-contain sm:h-36 sm:w-36"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />

      <div className="flex flex-col items-center">
        <span className="flex justify-center text-6xl font-extrabold tracking-tight text-[#FAFBFD] sm:text-7xl">
          {introLetters.map((letter, i) => (
            <span key={i} className="olaservir-letter" style={{ animationDelay: `${350 + i * 60}ms` }}>
              {letter}
            </span>
          ))}
        </span>
        <span
          className="olaservir-tagline mt-3 text-center text-base italic text-[#E2F4FF] sm:text-lg"
          style={{ animationDelay: `${350 + introLetters.length * 60 + 150}ms` }}
        >
          ...We are here to serve You
        </span>
      </div>
    </div>
  ) : null;

  if (authView === "verify" || authView === "forgot" || authView === "reset") {
    const inputClass =
      "w-full rounded-lg border border-[#E7E5E1] px-4 py-2.5 text-sm text-[#172236] focus:outline-none focus:ring-2 focus:ring-[#172236]/10";
    const inputStyle = { color: "#172236", WebkitTextFillColor: "#172236", caretColor: "#172236", backgroundColor: "#ffffff" };
    const codeInputClass = `${inputClass} text-center font-mono text-xl tracking-[0.4em]`;
    const submitClass =
      "w-full rounded-lg bg-[#172236] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#000109] disabled:opacity-60";

    const resendButton = (
      <p className="mt-5 text-center text-sm text-[#172236]/60">
        Didn&apos;t get it?{" "}
        <button
          type="button"
          onClick={handleResendCode}
          disabled={resendCooldown > 0}
          className="font-semibold text-[#172236] hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
        >
          {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
        </button>
      </p>
    );

    return (
      <main className="flex min-h-screen w-full flex-col items-center justify-center bg-[#FAFBFD] px-4 py-12" style={{ fontFamily: FONT_STACK }}>
        {introOverlay}
        <button onClick={() => { setAuthView("store"); setAuthError(""); setAuthInfo(""); }} className="mb-8 flex items-center gap-2">
          <img src="/images/LOGO.png" alt="Olaservir" className="h-8 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <span className="text-xl font-extrabold tracking-tight text-[#172236]">Olaservir</span>
        </button>

        <div className="w-full max-w-md rounded-2xl border border-[#E7E5E1] bg-white p-8 shadow-sm">
          {authError && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{authError}</p>}
          {authInfo && !authError && <p className="mb-4 rounded-lg bg-[#E2F4FF] px-3 py-2 text-sm text-[#172236]">{authInfo}</p>}

          {authView === "verify" && (
            <>
              <h1 className="text-2xl font-extrabold text-[#172236]">Verify your email</h1>
              <p className="mt-1 text-sm text-[#172236]/60">
                Enter the code we sent to <span className="font-semibold text-[#172236]/80">{pendingEmail}</span>.
              </p>
              <form onSubmit={handleVerifySignup} className="mt-6 space-y-4">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="------"
                  className={codeInputClass}
                  style={inputStyle}
                />
                <button type="submit" disabled={authSubmitting} className={submitClass}>
                  {authSubmitting ? "Verifying..." : "Verify & Continue"}
                </button>
              </form>
              {resendButton}
            </>
          )}

          {authView === "forgot" && (
            <>
              <h1 className="text-2xl font-extrabold text-[#172236]">Forgot your password?</h1>
              <p className="mt-1 text-sm text-[#172236]/60">Enter your email and we&apos;ll send you a code to reset it.</p>
              <form onSubmit={handleForgot} className="mt-6 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#172236]/80">Email</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <button type="submit" disabled={authSubmitting} className={submitClass}>
                  {authSubmitting ? "Sending code..." : "Send Reset Code"}
                </button>
              </form>
            </>
          )}

          {authView === "reset" && (
            <>
              <h1 className="text-2xl font-extrabold text-[#172236]">Reset your password</h1>
              <p className="mt-1 text-sm text-[#172236]/60">
                Enter the code sent to <span className="font-semibold text-[#172236]/80">{pendingEmail}</span> and choose a new password.
              </p>
              <form onSubmit={handleReset} className="mt-6 space-y-4">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="------"
                  className={codeInputClass}
                  style={inputStyle}
                />
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#172236]/80">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#172236]/80">Confirm New Password</label>
                  <input
                    type="password"
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    placeholder="Re-enter your new password"
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <button type="submit" disabled={authSubmitting} className={submitClass}>
                  {authSubmitting ? "Resetting..." : "Reset Password"}
                </button>
              </form>
              {resendButton}
            </>
          )}
        </div>

        <button
          onClick={() => { setAuthView("login"); setAuthError(""); setAuthInfo(""); }}
          className="mt-6 text-sm font-medium text-[#172236]/60 hover:text-[#172236]"
        >
          ← Back to log in
        </button>
      </main>
    );
  }

  if (authView === "signup" || authView === "login") {
    const isSignup = authView === "signup";

    return (
      <main className="flex min-h-screen w-full flex-col items-center justify-center bg-[#FAFBFD] px-4 py-12" style={{ fontFamily: FONT_STACK }}>
        {introOverlay}
        <button onClick={() => setAuthView("store")} className="mb-8 flex items-center gap-2">
          <img src="/images/LOGO.png" alt="Olaservir" className="h-8 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <span className="text-xl font-extrabold tracking-tight text-[#172236]">Olaservir</span>
        </button>

        <div className="w-full max-w-md rounded-2xl border border-[#E7E5E1] bg-white p-8 shadow-sm">
          <div className="mb-6 flex rounded-lg bg-[#E7E5E1] p-1">
            <button
              onClick={() => { setAuthView("signup"); setAuthError(""); }}
              className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${isSignup ? "bg-white text-[#172236] shadow-sm" : "text-[#172236]/50"}`}
            >
              Sign Up
            </button>
            <button
              onClick={() => { setAuthView("login"); setAuthError(""); }}
              className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${!isSignup ? "bg-white text-[#172236] shadow-sm" : "text-[#172236]/50"}`}
            >
              Log In
            </button>
          </div>

          <h1 className="text-2xl font-extrabold text-[#172236]">{isSignup ? "Create your account" : "Welcome back"}</h1>
          <p className="mt-1 text-sm text-[#172236]/60">
            {isSignup ? "Sign up to start shopping your everyday essentials." : "Log in to continue where you left off."}
          </p>

          {authError && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{authError}</p>}

          {isSignup ? (
            <form onSubmit={handleSignup} className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#172236]/80">Full Name</label>
                <input type="text" value={signupName} onChange={(e) => setSignupName(e.target.value)} placeholder="Jane Doe" className="w-full rounded-lg border border-[#E7E5E1] px-4 py-2.5 text-sm text-[#172236] focus:outline-none focus:ring-2 focus:ring-[#172236]/10" style={{ color: "#172236", WebkitTextFillColor: "#172236", caretColor: "#172236", backgroundColor: "#ffffff" }} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#172236]/80">Email</label>
                <input type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-lg border border-[#E7E5E1] px-4 py-2.5 text-sm text-[#172236] focus:outline-none focus:ring-2 focus:ring-[#172236]/10" style={{ color: "#172236", WebkitTextFillColor: "#172236", caretColor: "#172236", backgroundColor: "#ffffff" }} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#172236]/80">Password</label>
                <input type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} placeholder="At least 6 characters" className="w-full rounded-lg border border-[#E7E5E1] px-4 py-2.5 text-sm text-[#172236] focus:outline-none focus:ring-2 focus:ring-[#172236]/10" style={{ color: "#172236", WebkitTextFillColor: "#172236", caretColor: "#172236", backgroundColor: "#ffffff" }} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#172236]/80">Confirm Password</label>
                <input type="password" value={signupConfirm} onChange={(e) => setSignupConfirm(e.target.value)} placeholder="Re-enter your password" className="w-full rounded-lg border border-[#E7E5E1] px-4 py-2.5 text-sm text-[#172236] focus:outline-none focus:ring-2 focus:ring-[#172236]/10" style={{ color: "#172236", WebkitTextFillColor: "#172236", caretColor: "#172236", backgroundColor: "#ffffff" }} />
              </div>
              <button type="submit" disabled={authSubmitting} className="w-full rounded-lg bg-[#172236] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#000109] disabled:opacity-60">
                {authSubmitting ? "Creating account..." : "Create Account"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#172236]/80">Email</label>
                <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-lg border border-[#E7E5E1] px-4 py-2.5 text-sm text-[#172236] focus:outline-none focus:ring-2 focus:ring-[#172236]/10" style={{ color: "#172236", WebkitTextFillColor: "#172236", caretColor: "#172236", backgroundColor: "#ffffff" }} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#172236]/80">Password</label>
                <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Your password" className="w-full rounded-lg border border-[#E7E5E1] px-4 py-2.5 text-sm text-[#172236] focus:outline-none focus:ring-2 focus:ring-[#172236]/10" style={{ color: "#172236", WebkitTextFillColor: "#172236", caretColor: "#172236", backgroundColor: "#ffffff" }} />
              </div>
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => { setAuthView("forgot"); setAuthError(""); setAuthInfo(""); }}
                  className="text-sm font-medium text-[#172236]/70 hover:text-[#172236] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <button type="submit" disabled={authSubmitting} className="w-full rounded-lg bg-[#172236] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#000109] disabled:opacity-60">
                {authSubmitting ? "Signing in..." : "Log In"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-[#172236]/60">
            {isSignup ? "Already have an account? " : "Don't have an account? "}
            <button onClick={() => { setAuthView(isSignup ? "login" : "signup"); setAuthError(""); }} className="font-semibold text-[#172236] hover:underline">
              {isSignup ? "Log In" : "Sign Up"}
            </button>
          </p>
        </div>

        <button onClick={() => setAuthView("store")} className="mt-6 text-sm font-medium text-[#172236]/60 hover:text-[#172236]">← Back to store</button>
      </main>
    );
  }

  if (authView === "role-select") {
    return (
      <main className="flex min-h-screen w-full flex-col items-center justify-center bg-[#FAFBFD] px-4 py-12" style={{ fontFamily: FONT_STACK }}>
        {introOverlay}
        <div className="mb-8 flex items-center gap-2">
          <img src="/images/LOGO.png" alt="Olaservir" className="h-8 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <span className="text-xl font-extrabold tracking-tight text-[#172236]">Olaservir</span>
        </div>

        <div className="w-full max-w-md rounded-2xl border border-[#E7E5E1] bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-extrabold text-[#172236]">How will you use Olaservir?</h1>
          <p className="mt-1 text-sm text-[#172236]/60">Choose an account type to continue.</p>

          {roleError && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{roleError}</p>}

          <div className="mt-6 space-y-3">
            <button onClick={() => handleRoleChoice("buyer")} className="w-full rounded-lg bg-[#172236] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#000109]">
              Continue as Buyer
            </button>
            <button onClick={() => handleRoleChoice("admin")} className="w-full rounded-lg border border-[#E7E5E1] py-3 text-sm font-semibold text-[#172236] transition-colors hover:bg-[#E7E5E1]">
              Continue as Admin
            </button>
          </div>
        </div>
      </main>
    );
  }

  const renderProductCard = (product: LiveProduct, isNew: boolean) => {
    const priceLabel = `₦${product.price.toLocaleString()}`;
    const rating = product.rating ?? 0;

    return (
      <div
        key={`${isNew ? "new" : "avail"}-${product.id}`}
        id={isNew ? `new-${product.slug}` : `product-${product.slug}`}
        className="overflow-hidden rounded-xl border border-[#E7E5E1] bg-white"
      >
        <div className="relative">
          <a
            href={`/product/${product.slug}`}
            className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-[#E7E5E1] text-xs text-[#172236]/40"
          >
            {isNew && (
              <span className="absolute left-3 top-3 z-10 rounded-md bg-[#172236] px-2 py-1 text-[11px] font-semibold text-white">New</span>
            )}
            {product.images?.[0] ? (
              <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              "Image"
            )}
          </a>
          <button
            aria-label="Add to wishlist"
            onClick={() => toggleWishlist({ id: product.id, name: product.name, price: priceLabel })}
            className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm ${isWishlisted(product.id) ? "text-red-500" : "text-[#172236]"}`}
          >
            <Heart size={16} strokeWidth={1.75} fill={isWishlisted(product.id) ? "currentColor" : "none"} />
          </button>
        </div>

        <a href={`/product/${product.slug}`} className="block px-4 pt-4">
          <p className="text-sm font-semibold text-[#172236]">{product.name}</p>

          <div className="mt-1.5 flex items-center gap-1.5">
            <div className="flex text-[#172236]">
              {Array.from({ length: 5 }).map((_, i) => {
                const filled = i + 1 <= Math.floor(rating);
                const half = !filled && i < rating;
                return (
                  <Star
                    key={i}
                    size={13}
                    fill={filled || half ? "currentColor" : "none"}
                    strokeWidth={1.5}
                    className={half ? "opacity-50" : ""}
                  />
                );
              })}
            </div>
            <span className="text-xs text-[#172236]/60">({product.reviews_count ?? 0})</span>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-sm font-bold text-[#172236]">{priceLabel}</span>
            {product.original_price && (
              <span className="text-xs text-[#172236]/40 line-through">₦{product.original_price.toLocaleString()}</span>
            )}
          </div>
        </a>

        <div className="px-4 pb-4">
          <button
            onClick={() => addToCart({ id: product.id, name: product.name, price: priceLabel })}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#172236] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#000109]"
          >
            <ShoppingCart size={15} />
            Add to Cart
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen w-full bg-[#E7E5E1]" style={{ fontFamily: FONT_STACK }}>
      {introOverlay}

      {!introVisible && locationChoice !== "yes" && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#000109]/60 px-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl bg-[#FAFBFD] p-8 text-center shadow-xl">
            {locationChoice === "ask" ? (
              <>
                <h2 className="text-2xl font-extrabold text-[#172236]">Hello, good day!</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#172236]/70 sm:text-base">
                  <span className="font-semibold text-[#172236]">Olaservir</span> is only available in Lagos now.
                  Do you still wish to continue shopping?
                </p>
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setLocationChoice("no")}
                    className="flex-1 rounded-lg border border-[#E7E5E1] py-3 text-sm font-semibold text-[#172236] transition-colors hover:bg-[#E7E5E1]"
                  >
                    No
                  </button>
                  <button
                    onClick={() => setLocationChoice("yes")}
                    className="flex-1 rounded-lg bg-[#172236] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#000109]"
                  >
                    Yes
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-extrabold text-[#172236]">Thank you for stopping by</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#172236]/70 sm:text-base">
                  We hope to reach you very soon.
                </p>
                <button
                  onClick={() => setLocationChoice("ask")}
                  className="mt-6 w-full rounded-lg border border-[#E7E5E1] py-3 text-sm font-semibold text-[#172236] transition-colors hover:bg-[#E7E5E1]"
                >
                  Go back
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1280px] bg-[#FAFBFD] shadow-sm">
      <header className="w-full border-b border-[#E7E5E1] bg-[#FAFBFD]">
        <div className="h-1.5 w-full bg-[#172236]" />

        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6 lg:px-10">
          <a href="#" className="flex shrink-0 items-center gap-2">
            <img src="/images/LOGO.png" alt="Olaservir" className="h-9 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <span className="text-2xl font-extrabold tracking-tight text-[#172236]">Olaservir</span>
          </a>

          <nav
            ref={navRef}
            className="relative order-3 flex w-full items-center gap-5 overflow-x-auto whitespace-nowrap pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-6 md:gap-7 lg:order-none lg:w-auto lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden"
          >
            {NAV_LINKS.map(({ label, target }) => (
              <button
                key={label}
                ref={(el) => { linkRefs.current[label] = el; }}
                onClick={() => {
                  setActive(label);
                  if (target === null) {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  } else {
                    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
                className={`flex items-center gap-1 whitespace-nowrap pb-1 text-[15px] font-medium transition-colors ${active === label ? "text-[#172236]" : "text-[#172236]/70 hover:text-[#172236]"}`}
              >
                {label}
              </button>
            ))}

            <span className="pointer-events-none absolute bottom-0 h-[2px] bg-[#172236] transition-all duration-300 ease-out" style={{ left: underline.left, width: underline.width }} />
          </nav>

          <div className="flex shrink-0 items-center gap-6">
            <div className="relative hidden md:block">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => searchQuery && setSearchOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchResults.length > 0) goToResult(searchResults[0].id);
                  if (e.key === "Escape") setSearchOpen(false);
                }}
                placeholder="Search for products..."
                className="w-64 rounded-full bg-[#E7E5E1] py-2.5 pl-5 pr-11 text-sm text-[#172236] placeholder:text-[#172236]/40 focus:outline-none focus:ring-2 focus:ring-[#172236]/10"
              />
              <button
                aria-label="Search"
                onClick={() => { if (searchResults.length > 0) goToResult(searchResults[0].id); }}
                className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[#172236] text-white"
              >
                <Search size={15} />
              </button>

              {searchOpen && searchQuery.trim().length > 0 && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSearchOpen(false)} />
                  <div className="absolute left-0 top-full z-50 mt-2 w-full rounded-xl border border-[#E7E5E1] bg-white shadow-lg">
                    {searchResults.length === 0 ? (
                      <p className="px-4 py-4 text-sm text-[#172236]/60">No results for &quot;{searchQuery}&quot;</p>
                    ) : (
                      searchResults.map((item) => (
                        <button key={item.id} onClick={() => goToResult(item.id)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-[#E2F4FF]">
                          <div>
                            <p className="text-sm font-medium text-[#172236]">{item.name}</p>
                            <p className="text-xs text-[#172236]/40">{item.kind}</p>
                          </div>
                          {item.price && <span className="text-xs font-semibold text-[#172236]">{item.price}</span>}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {user?.role === "seller" && (
              <div className="hidden items-center gap-2 sm:flex">
                <a href="/seller/dashboard" className="flex items-center gap-1.5 rounded-lg border border-[#E7E5E1] px-3 py-2 text-sm font-semibold text-[#172236] hover:bg-[#E2F4FF]">
                  <Store size={16} />
                  Seller Dashboard
                </a>
                <a href="/seller/new-listing" className="flex items-center gap-1.5 rounded-lg bg-[#172236] px-3 py-2 text-sm font-semibold text-white hover:bg-[#000109]">
                  <ShoppingBag size={16} />
                  List New Item
                </a>
              </div>
            )}

            <div className="relative">
              <button aria-label="Account" onClick={() => setAccountOpen((o) => !o)} className="text-[#172236]">
                <User size={22} strokeWidth={1.75} />
              </button>

              {accountOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-3 w-56 rounded-xl border border-[#E7E5E1] bg-white p-2 shadow-lg">
                    {authLoading ? (
                      <p className="px-3 py-4 text-center text-sm text-[#172236]/40">Loading...</p>
                    ) : user ? (
                      <>
                        <div className="px-3 py-2">
                          <p className="text-sm font-semibold text-[#172236]">{user.name}</p>
                          <p className="truncate text-xs text-[#172236]/60">{user.email}</p>
                          <span className="mt-1 inline-block rounded-full bg-[#E7E5E1] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#172236]/70">{user.role}</span>
                        </div>
                        {user.role === "seller" && (
                          <>
                            <a href="/seller/dashboard" className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#172236]/80 hover:bg-[#E2F4FF]">
                              <Store size={15} />
                              Seller Dashboard
                            </a>
                            <a href="/seller/new-listing" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#172236]/80 hover:bg-[#E2F4FF]">
                              <ShoppingBag size={15} />
                              List an Item
                            </a>
                          </>
                        )}
                        <button onClick={handleLogout} className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-[#172236]/80 hover:bg-[#E2F4FF]">
                          Log Out
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setAuthView("signup"); setAccountOpen(false); setAuthError(""); }} className="w-full rounded-lg bg-[#172236] px-3 py-2 text-sm font-semibold text-white hover:bg-[#000109]">
                          Sign Up
                        </button>
                        <button onClick={() => { setAuthView("login"); setAccountOpen(false); setAuthError(""); }} className="mt-1 w-full rounded-lg border border-[#E7E5E1] px-3 py-2 text-sm font-semibold text-[#172236] hover:bg-[#E2F4FF]">
                          Log In
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button aria-label="Wishlist" onClick={() => setWishlistOpen((o) => !o)} className="relative text-[#172236]">
                <Heart size={22} strokeWidth={1.75} />
                {wishlist.length > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#172236] text-[10px] font-semibold text-white">{wishlist.length}</span>
                )}
              </button>

              {wishlistOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setWishlistOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-3 w-80 rounded-xl border border-[#E7E5E1] bg-white shadow-lg">
                    <div className="flex items-center justify-between border-b border-[#E7E5E1] px-4 py-3">
                      <p className="text-sm font-semibold text-[#172236]">Liked Items ({wishlist.length})</p>
                      <button aria-label="Close wishlist" onClick={() => setWishlistOpen(false)} className="text-[#172236]/40 hover:text-[#172236]">✕</button>
                    </div>

                    {wishlist.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-[#172236]/60">You haven&apos;t liked anything yet.</p>
                    ) : (
                      <div className="max-h-72 overflow-y-auto">
                        {wishlist.map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-3 border-b border-[#E7E5E1]/60 px-4 py-3 last:border-b-0">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#E7E5E1] text-[10px] text-[#172236]/40">Img</div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-[#172236]">{item.name}</p>
                              <p className="text-xs text-[#172236]/60">{item.price}</p>
                            </div>
                            <button aria-label={`Add ${item.name} to cart`} onClick={() => addToCart(item)} className="text-xs font-medium text-[#172236]/40 hover:text-[#172236]">
                              Add to Cart
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button aria-label="Cart" onClick={() => setCartOpen((o) => !o)} className="relative text-[#172236]">
                <ShoppingCart size={22} strokeWidth={1.75} />
                <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#172236] text-[10px] font-semibold text-white">{cartCount}</span>
              </button>

              {cartOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setCartOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-3 w-80 rounded-xl border border-[#E7E5E1] bg-white shadow-lg">
                    <div className="flex items-center justify-between border-b border-[#E7E5E1] px-4 py-3">
                      <p className="text-sm font-semibold text-[#172236]">Your Cart ({cartCount})</p>
                      <button aria-label="Close cart" onClick={() => setCartOpen(false)} className="text-[#172236]/40 hover:text-[#172236]">✕</button>
                    </div>

                    {cart.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-[#172236]/60">Your cart is empty.</p>
                    ) : (
                      <div className="max-h-72 overflow-y-auto">
                        {cart.map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-3 border-b border-[#E7E5E1]/60 px-4 py-3 last:border-b-0">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#E7E5E1] text-[10px] text-[#172236]/40">Img</div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-[#172236]">{item.name}</p>
                              <p className="text-xs text-[#172236]/60">Qty {item.qty} · {item.price}</p>
                            </div>
                            <button aria-label={`Remove ${item.name}`} onClick={() => removeFromCart(item.id)} className="text-xs font-medium text-[#172236]/40 hover:text-red-500">
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {cart.length > 0 && (
                      <div className="border-t border-[#E7E5E1] px-4 py-3">
                        <div className="mb-3 flex items-center justify-between text-sm">
                          <span className="text-[#172236]/60">Subtotal</span>
                          <span className="font-semibold text-[#172236]">₦{cartTotal.toLocaleString()}</span>
                        </div>
                        <button onClick={handleCheckout} className="w-full rounded-lg bg-[#172236] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#000109]">
                          Checkout
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="w-full bg-[#FAFBFD] px-4 py-6 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 items-center gap-10 rounded-3xl bg-gradient-to-r from-[#E7E5E1] to-[#E2F4FF] px-6 py-12 sm:px-10 lg:grid-cols-2 lg:gap-6 lg:py-16">
          <div className="max-w-xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-[#172236]/60">NEW COLLECTION 2026</p>

            <h1 className="mt-3 text-5xl font-extrabold leading-[1.05] tracking-tight text-[#172236] sm:text-6xl">
              Shop your everyday
              <br />
              <span className="text-[#172236]">essentials</span>
            </h1>

            <p className="mt-5 max-w-md text-base text-[#172236]/70 sm:text-lg">
              Premium quality, modern style, timeless pieces for your everyday life.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <button className="flex items-center gap-2 rounded-lg bg-[#172236] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#000109]">
                Shop Collection
                <ArrowRight size={16} />
              </button>
              <button className="rounded-lg border border-[#172236]/20 bg-white/60 px-6 py-3.5 text-sm font-semibold text-[#172236] transition-colors hover:bg-white">
                Explore Deals
              </button>
            </div>

            <p className="mt-4 flex max-w-md items-start gap-2 text-sm text-[#172236]/70">
              <Truck size={16} className="mt-0.5 shrink-0" />
              Deliveries are done using Bolt and the charges are the responsibility of the customer.
            </p>
          </div>

          <div className="relative h-[320px] w-full overflow-hidden rounded-2xl bg-white/50 sm:h-[420px] lg:h-[480px]">
            {HERO_SLOTS.map((slotKey, i) => {
              const image = heroImages[slotKey];
              const offset = (i - heroSlide + HERO_SLOTS.length) % HERO_SLOTS.length;
              return (
                <div
                  key={slotKey}
                  style={{ transform: `translateX(${offset === 0 ? 0 : offset === 1 ? 100 : -100}%)` }}
                  className={`group/image absolute inset-0 flex items-center justify-center ${offset === 1 ? "" : "transition-transform duration-700 ease-in-out"} ${offset === 0 ? "" : "pointer-events-none"}`}
                >
                  {image ? (
                    <img src={image} alt={`Hero showcase ${i + 1}`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[#172236]/40">
                      <ImagePlus size={28} strokeWidth={1.5} />
                      <span className="text-xs font-medium">Image placeholder {i + 1} of {HERO_SLOTS.length}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    aria-label={`Upload hero image ${i + 1}`}
                    onClick={() => fileInputRefs.current[slotKey]?.click()}
                    className="absolute bottom-4 left-4 flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-medium text-[#172236] opacity-0 shadow-sm transition-opacity group-hover/image:opacity-100"
                  >
                    <ImagePlus size={13} />
                    {image ? "Replace" : "Upload"}
                  </button>
                  <input ref={(el) => { fileInputRefs.current[slotKey] = el; }} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, slotKey, setHeroImages)} />
                </div>
              );
            })}

            <div className="absolute bottom-4 right-4 flex gap-1.5">
              {HERO_SLOTS.map((slotKey, i) => (
                <button key={slotKey} aria-label={`Show hero image ${i + 1}`} onClick={() => setHeroSlide(i)} className={`h-1.5 rounded-full transition-all ${heroSlide === i ? "w-5 bg-[#172236]" : "w-1.5 bg-[#172236]/30"}`} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="w-full bg-[#E7E5E1]">
        <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-y-6 divide-[#172236]/10 px-6 py-8 sm:px-10 md:grid-cols-4 md:divide-x lg:px-12">
          {TRUST_ITEMS.map(({ icon: Icon, title, subtitle }, i) => (
            <div key={title} className={`flex items-center gap-4 px-2 ${i > 0 ? "md:pl-8" : ""}`}>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#E2F4FF] text-[#172236]">
                <Icon size={22} strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#172236]">{title}</p>
                <p className="text-sm text-[#172236]/60">{subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="w-full bg-[#FAFBFD] px-6 py-12 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-extrabold text-[#172236] sm:text-3xl">Shop by Category</h2>
            <a href="#" className="flex items-center gap-1 text-sm font-medium text-[#172236]/80 hover:text-[#172236]">
              View All Categories
              <ArrowRight size={15} />
            </a>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {CATEGORIES.map(({ name, count }) => {
              const key = slugify(name);
              const refKey = `cat-${key}`;
              const image = categoryImages[key];
              return (
                <div key={name} id={refKey} className="overflow-hidden rounded-xl border border-[#E7E5E1] bg-white text-left transition-all duration-300 hover:z-10 hover:scale-105 hover:shadow-md">
                  <div className="group/image relative aspect-square w-full overflow-hidden bg-[#E7E5E1]">
                    {image ? (
                      <img src={image} alt={name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-[#172236]/40">Image</div>
                    )}
                    <button
                      type="button"
                      aria-label={`Upload image for ${name}`}
                      onClick={() => fileInputRefs.current[refKey]?.click()}
                      className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-[#172236] opacity-0 shadow-sm transition-opacity group-hover/image:opacity-100"
                    >
                      <ImagePlus size={13} />
                      {image ? "Replace" : "Upload"}
                    </button>
                    <input ref={(el) => { fileInputRefs.current[refKey] = el; }} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, key, setCategoryImages)} />
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm font-semibold text-[#172236]">{name}</p>
                    <p className="text-sm text-[#172236]/60">{count}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="available-products" className="w-full bg-[#FAFBFD] px-6 pb-16 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-extrabold text-[#172236] sm:text-3xl">Available Products</h2>
            <a href="#" className="flex items-center gap-1 text-sm font-medium text-[#172236]/80 hover:text-[#172236]">
              View All Products
              <ArrowRight size={15} />
            </a>
          </div>

          {productsLoading ? (
            <p className="text-sm text-[#172236]/60">Loading products…</p>
          ) : availableProducts.length === 0 ? (
            <p className="text-sm text-[#172236]/60">No products listed yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {availableProducts.map((product) => renderProductCard(product, false))}
            </div>
          )}
        </div>
      </section>

      <section className="w-full bg-[#FAFBFD] px-6 pt-2 sm:px-10 lg:px-12">
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 md:grid-cols-2">
          {PROMO_BANNERS.map(({ title, subtitle, bg }) => (
            <div key={title} className={`grid grid-cols-2 items-center overflow-hidden rounded-2xl bg-gradient-to-br ${bg} px-8 py-8`}>
              <div>
                <h3 className="text-2xl font-extrabold text-[#172236]">{title}</h3>
                <p className="mt-2 text-sm text-[#172236]/70">{subtitle}</p>
                <button className="mt-5 flex items-center gap-2 rounded-lg border border-[#172236]/20 bg-white px-5 py-2.5 text-sm font-semibold text-[#172236] transition-colors hover:bg-[#172236] hover:text-white">
                  Shop Collection
                  <ArrowRight size={15} />
                </button>
              </div>
              <div className="flex h-40 w-full items-center justify-center rounded-xl bg-white/40 text-xs text-[#172236]/60 sm:h-48">Image</div>
            </div>
          ))}
        </div>
      </section>

      <section id="new-arrivals" className="w-full bg-[#FAFBFD] px-6 py-12 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-extrabold text-[#172236] sm:text-3xl">New Arrivals</h2>
            <a href="#" className="flex items-center gap-1 text-sm font-medium text-[#172236]/80 hover:text-[#172236]">
              View All
              <ArrowRight size={15} />
            </a>
          </div>

          {productsLoading ? (
            <p className="text-sm text-[#172236]/60">Loading products…</p>
          ) : newArrivals.length === 0 ? (
            <p className="text-sm text-[#172236]/60">No items posted in the last 24 hours.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {newArrivals.map((product) => renderProductCard(product, true))}
            </div>
          )}
        </div>
      </section>

      <footer id="about-us" className="w-full bg-[#172236] text-[#FAFBFD]">
        <div className="mx-auto max-w-[1600px] px-6 py-12 sm:px-10 lg:px-12">
          <div className="rounded-2xl bg-[#000109] px-6 py-8 sm:px-10">
            <h2 className="text-xl font-extrabold text-[#FAFBFD] sm:text-2xl">Olaservir — We Are Here to Serve You</h2>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#E7E5E1]/80 sm:text-base">
              Olaservir — We are here to serve you.

Olaservir is an online retail brand committed to making quality products accessible, convenient, and reliable. We carefully select products that combine style, functionality, and value, while putting quality and customer satisfaction at the heart of everything we do.

Starting with fashion essentials, Olaservir is built with a vision to become a trusted destination for a wider range of products for everyday living.

Quality. Excellence. Convenience.
That is the Olaservir standard.
            </p>
          </div>
        </div>

        <div className="border-t border-[#FAFBFD]/10">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-10 gap-y-4 px-6 py-6 sm:px-10 lg:px-12">
            <a href="mailto:olamideakinjare@gmail.com" className="flex items-center gap-3 text-sm text-[#E7E5E1]/90 hover:text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FAFBFD] text-[#172236]">
                <Mail size={16} />
              </span>
              <span>
                <span className="block text-xs font-semibold uppercase tracking-wide text-[#E7E5E1]/60">Email Support</span>
               olaservirglobal@gmail.com -
              </span>
            </a>

            <a href="tel:+2349164908679" className="flex items-center gap-3 text-sm text-[#E7E5E1]/90 hover:text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FAFBFD] text-[#172236]">
                <Phone size={16} />
              </span>
              <span>
                <span className="block text-xs font-semibold uppercase tracking-wide text-[#E7E5E1]/60">Phone Support</span>
                09025415837

              </span>
            </a>
          </div>
        </div>

        <div className="border-t border-[#FAFBFD]/10">
          <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-8 px-6 py-10 sm:px-10 sm:grid-cols-4 lg:px-12">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-[#E7E5E1]/60">About Olaservir</h3>
              <ul className="mt-3 space-y-2 text-sm text-[#E7E5E1]/90">
                <li><a href="#" className="hover:text-white">Contact Us</a></li>
                <li><a href="#" className="hover:text-white">About Us</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
                <li><a href="#" className="hover:text-white">Our Blog</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-[#E7E5E1]/60">Buying on Olaservir</h3>
              <ul className="mt-3 space-y-2 text-sm text-[#E7E5E1]/90">
                <li><a href="#" className="hover:text-white">Buyer Safety Centre</a></li>
                <li><a href="#" className="hover:text-white">FAQs</a></li>
                <li><a href="#" className="hover:text-white">Delivery</a></li>
                <li><a href="#" className="hover:text-white">Return Policy</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-[#E7E5E1]/60">More Info</h3>
              <ul className="mt-3 space-y-2 text-sm text-[#E7E5E1]/90">
                <li><a href="#" className="hover:text-white">Site Map</a></li>
                <li><a href="/order-demo" className="hover:text-white">Track My Order</a></li>
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Use</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-[#E7E5E1]/60">Connect With Us</h3>
              <div className="mt-3 flex gap-2">
                <a href="#" aria-label="Facebook" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FAFBFD]/10 text-[#FAFBFD] hover:bg-[#FAFBFD]/20"><FacebookIcon /></a>
                <a href="#" aria-label="Twitter / X" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FAFBFD]/10 text-[#FAFBFD] hover:bg-[#FAFBFD]/20"><TwitterIcon /></a>
                <a href="#" aria-label="Instagram" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FAFBFD]/10 text-[#FAFBFD] hover:bg-[#FAFBFD]/20"><InstagramIcon /></a>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[#FAFBFD]/10 px-6 py-5 text-center text-xs text-[#E7E5E1]/50 sm:px-10 lg:px-12">
          Copyright © 2026 Olaservir. All rights reserved.
        </div>
      </footer>
      </div>
    </main>
  );
}