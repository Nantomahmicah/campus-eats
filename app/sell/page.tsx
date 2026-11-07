"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../Lib/supabase";
import type { User } from "@supabase/supabase-js";

const CATEGORIES = [
  "Food & Drinks",
  "Electronics & Phones",
  "Fashion & Clothing",
  "Books & Stationery",
  "Beauty & Personal Care",
  "Room & Hostel Items",
  "Services",
  "Other",
];

// Categories where "New / Used" doesn't make sense
const NO_CONDITION_CATEGORIES = ["Food & Drinks", "Services"];

export default function Sell() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [pickupMinutes, setPickupMinutes] = useState("");
  const [deliveryMinutes, setDeliveryMinutes] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const showCondition = category !== "" && !NO_CONDITION_CATEGORIES.includes(category);

  useEffect(() => {
    async function checkUser() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login?redirect=/sell");
      } else {
        setUser(data.user);
      }
      setCheckingAuth(false);
    }
    checkUser();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setErrorMsg("");
    setSuccess(false);

    try {
      let sellerId: number;

      const { data: existingSeller } = await supabase
        .from("sellers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingSeller) {
        sellerId = existingSeller.id;
      } else {
        const { data: newSeller, error: sellerError } = await supabase
          .from("sellers")
          .insert({
            business_name: businessName,
            phone_number: phone,
            location,
            user_id: user.id,
          })
          .select("id")
          .single();

        if (sellerError) throw sellerError;
        sellerId = newSeller.id;
      }

      let imageUrl: string | null = null;
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("food-images")
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("food-images")
          .getPublicUrl(fileName);

        imageUrl = publicUrlData.publicUrl;
      }

      const { error: itemError } = await supabase.from("Foods").insert({
        name: itemName,
        price: Number(price),
        seller_id: sellerId,
        image_url: imageUrl,
        pickup_minutes: Number(pickupMinutes),
        delivery_minutes: Number(deliveryMinutes),
        category,
        description: description.trim() || null,
        condition: showCondition ? condition : null,
      });

      if (itemError) throw itemError;

      setSuccess(true);
      setItemName("");
      setPrice("");
      setPickupMinutes("");
      setDeliveryMinutes("");
      setDescription("");
      setCondition("");
      setImageFile(null);
      setImagePreview(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingAuth) {
    return (
      <main className="market-shell flex items-center justify-center">
        <p className="text-gray-600">Checking login...</p>
      </main>
    );
  }

  return (
    <main className="market-shell p-4 sm:p-6">
      <div className="max-w-md mx-auto">
        <div className="market-panel mb-4 flex items-center justify-between rounded-2xl px-4 py-3">
          <a href="/dashboard" className="text-green-700 text-sm font-semibold hover:underline">
            ← Dashboard
          </a>
          <button onClick={handleLogout} className="text-sm text-gray-500 underline">
            Log out
          </button>
        </div>

        <div className="market-panel rounded-3xl p-6 sm:p-7">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-xl">
              🛒
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Sell on Campus Mall</h1>
          </div>
          <p className="text-gray-600 mb-6 text-sm">Logged in as {user?.email}</p>

          {success && (
            <div className="bg-green-50 text-green-800 p-3 rounded-lg mb-4 text-sm border border-green-100">
              ✅ Listing added! Check the homepage.
            </div>
          )}
          {errorMsg && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm border border-red-100">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Shop / seller name</label>
              <input
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="market-input w-full"
                placeholder="e.g. Kwame's Gadgets"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Phone number</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="market-input w-full"
                  placeholder="024xxxxxxx"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Location</label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="market-input w-full"
                  placeholder="Near Main Gate"
                />
              </div>
            </div>

            <hr className="border-gray-200" />

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Item name</label>
              <input
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="market-input w-full"
                placeholder="e.g. Jollof rice, iPhone 11, Statistics textbook"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Category</label>
              <select
                required
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  if (NO_CONDITION_CATEGORIES.includes(e.target.value)) setCondition("");
                }}
                className="market-input w-full"
              >
                <option value="" disabled>
                  Choose a category
                </option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {showCondition && (
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Condition</label>
                <select
                  required
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="market-input w-full"
                >
                  <option value="" disabled>
                    New or used?
                  </option>
                  <option value="New">New</option>
                  <option value="Used">Used</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                Description <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
                className="market-input w-full"
                placeholder="e.g. 64GB, battery health 87%, comes with charger"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Price (GH₵)</label>
              <input
                required
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="market-input w-full"
                placeholder="25"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Ready for pickup in (min)</label>
                <input
                  required
                  min="0"
                  type="number"
                  value={pickupMinutes}
                  onChange={(e) => setPickupMinutes(e.target.value)}
                  className="market-input w-full"
                  placeholder="e.g. 20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Delivery time (min)</label>
                <input
                  required
                  min="0"
                  type="number"
                  value={deliveryMinutes}
                  onChange={(e) => setDeliveryMinutes(e.target.value)}
                  className="market-input w-full"
                  placeholder="e.g. 35"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Photo</label>
              {imagePreview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-40 object-cover rounded-lg border border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                    className="absolute top-2 right-2 bg-white/90 text-gray-700 text-xs px-2 py-1 rounded-full shadow"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-green-200 bg-green-50/50 transition-colors hover:border-green-500 hover:bg-green-50">
                  <span className="text-2xl mb-1">📷</span>
                  <span className="text-sm text-gray-500">Tap to add a photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-100">
              Not allowed: weapons, illegal drugs, stolen or counterfeit goods, or anything else
              illegal. Listings that break these rules will be removed.
            </p>

            <button
              type="submit"
              disabled={submitting}
              className="market-button w-full py-2.5 disabled:opacity-50"
            >
              {submitting ? "Adding..." : "Add Listing"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}