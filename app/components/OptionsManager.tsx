"use client";

import { useEffect, useState } from "react";
import { supabase } from "../Lib/supabase";

type Size = { id: number; name: string; price: number };
type Addon = { id: number; name: string; price: number; image_url: string | null };

type Props = {
  foodId: number;
};

export default function FoodOptionsManager({ foodId }: Props) {
  const [sizes, setSizes] = useState<Size[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add-size form
  const [newSizeName, setNewSizeName] = useState("");
  const [newSizePrice, setNewSizePrice] = useState("");
  const [addingSize, setAddingSize] = useState(false);

  // Edit-size state
  const [editingSizeId, setEditingSizeId] = useState<number | null>(null);
  const [editSizeName, setEditSizeName] = useState("");
  const [editSizePrice, setEditSizePrice] = useState("");
  const [savingSizeId, setSavingSizeId] = useState<number | null>(null);

  // Add-addon form
  const [newAddonName, setNewAddonName] = useState("");
  const [newAddonPrice, setNewAddonPrice] = useState("");
  const [newAddonImageFile, setNewAddonImageFile] = useState<File | null>(null);
  const [addingAddon, setAddingAddon] = useState(false);

  // Edit-addon state
  const [editingAddonId, setEditingAddonId] = useState<number | null>(null);
  const [editAddonName, setEditAddonName] = useState("");
  const [editAddonPrice, setEditAddonPrice] = useState("");
  const [editAddonImageFile, setEditAddonImageFile] = useState<File | null>(null);
  const [savingAddonId, setSavingAddonId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: sizeData, error: sizeErr }, { data: addonData, error: addonErr }] =
      await Promise.all([
        supabase.from("food_sizes").select("id, name, price").eq("food_id", foodId).order("price"),
        supabase
          .from("food_addons")
          .select("id, name, price, image_url")
          .eq("food_id", foodId)
          .order("price"),
      ]);
    if (sizeErr || addonErr) {
      setError(sizeErr?.message || addonErr?.message || "Could not load options");
    } else {
      setSizes(sizeData ?? []);
      setAddons(addonData ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foodId]);

  async function uploadAddonImage(file: File): Promise<string> {
    const fileExt = file.name.split(".").pop();
    const fileName = `addon-${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from("food-images").upload(fileName, file);
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from("food-images").getPublicUrl(fileName);
    return data.publicUrl;
  }

  // --- Sizes ---

  async function addSize() {
    const price = parseFloat(newSizePrice);
    if (!newSizeName.trim() || isNaN(price) || price <= 0) return;
    setAddingSize(true);
    setError("");
    const { error } = await supabase
      .from("food_sizes")
      .insert({ food_id: foodId, name: newSizeName.trim(), price });
    if (error) setError(error.message);
    else {
      setNewSizeName("");
      setNewSizePrice("");
      await load();
    }
    setAddingSize(false);
  }

  function startEditingSize(size: Size) {
    setEditingSizeId(size.id);
    setEditSizeName(size.name);
    setEditSizePrice(String(size.price));
  }

  async function saveSizeEdit(id: number) {
    const price = parseFloat(editSizePrice);
    if (!editSizeName.trim() || isNaN(price) || price <= 0) return;
    setSavingSizeId(id);
    setError("");
    const { error } = await supabase
      .from("food_sizes")
      .update({ name: editSizeName.trim(), price })
      .eq("id", id);
    if (error) setError(error.message);
    else {
      setEditingSizeId(null);
      await load();
    }
    setSavingSizeId(null);
  }

  async function removeSize(id: number) {
    const { error } = await supabase.from("food_sizes").delete().eq("id", id);
    if (error) setError(error.message);
    else setSizes((prev) => prev.filter((s) => s.id !== id));
  }

  // --- Add-ons ---

  async function addAddon() {
    const price = parseFloat(newAddonPrice);
    if (!newAddonName.trim() || isNaN(price) || price < 0) return;
    setAddingAddon(true);
    setError("");
    try {
      let image_url: string | null = null;
      if (newAddonImageFile) {
        image_url = await uploadAddonImage(newAddonImageFile);
      }
      const { error } = await supabase
        .from("food_addons")
        .insert({ food_id: foodId, name: newAddonName.trim(), price, image_url });
      if (error) throw error;
      setNewAddonName("");
      setNewAddonPrice("");
      setNewAddonImageFile(null);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not add this add-on");
    }
    setAddingAddon(false);
  }

  function startEditingAddon(addon: Addon) {
    setEditingAddonId(addon.id);
    setEditAddonName(addon.name);
    setEditAddonPrice(String(addon.price));
    setEditAddonImageFile(null);
  }

  async function saveAddonEdit(id: number) {
    const price = parseFloat(editAddonPrice);
    if (!editAddonName.trim() || isNaN(price) || price < 0) return;
    setSavingAddonId(id);
    setError("");
    try {
      const updates: { name: string; price: number; image_url?: string } = {
        name: editAddonName.trim(),
        price,
      };
      if (editAddonImageFile) {
        updates.image_url = await uploadAddonImage(editAddonImageFile);
      }
      const { error } = await supabase.from("food_addons").update(updates).eq("id", id);
      if (error) throw error;
      setEditingAddonId(null);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save this add-on");
    }
    setSavingAddonId(null);
  }

  async function removeAddon(id: number) {
    const { error } = await supabase.from("food_addons").delete().eq("id", id);
    if (error) setError(error.message);
    else setAddons((prev) => prev.filter((a) => a.id !== id));
  }

  if (loading) return <p className="text-sm text-gray-600 mt-2">Loading options...</p>;

  return (
    <div className="mt-3 space-y-4 border-t pt-3">
      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      {/* Sizes */}
      <div>
        <p className="text-sm font-semibold text-gray-900 mb-1">
          Sizes <span className="font-normal text-gray-500">(buyer picks one; sets the price)</span>
        </p>
        <div className="space-y-1 mb-2">
          {sizes.map((s) =>
            editingSizeId === s.id ? (
              <div key={s.id} className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1.5">
                <input
                  value={editSizeName}
                  onChange={(e) => setEditSizeName(e.target.value)}
                  className="border rounded px-2 py-1 text-sm flex-1 text-gray-900"
                />
                <input
                  value={editSizePrice}
                  onChange={(e) => setEditSizePrice(e.target.value)}
                  type="number"
                  step="0.01"
                  className="border rounded px-2 py-1 text-sm w-20 text-gray-900"
                />
                <button
                  onClick={() => saveSizeEdit(s.id)}
                  disabled={savingSizeId === s.id}
                  className="text-xs px-2 py-1 rounded bg-green-600 text-white font-medium disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingSizeId(null)}
                  className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-800 font-medium"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div
                key={s.id}
                className="flex items-center justify-between text-sm bg-gray-50 rounded px-2 py-1.5"
              >
                <span className="font-medium text-gray-900">
                  {s.name} — GH₵{s.price}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => startEditingSize(s)}
                    className="text-blue-700 text-xs font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => removeSize(s.id)}
                    className="text-red-600 text-xs font-semibold"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          )}
          {sizes.length === 0 && <p className="text-sm text-gray-500">No sizes added yet.</p>}
        </div>
        <div className="flex gap-2">
          <input
            value={newSizeName}
            onChange={(e) => setNewSizeName(e.target.value)}
            placeholder="e.g. Large"
            className="border rounded px-2 py-1 text-sm flex-1 text-gray-900"
          />
          <input
            value={newSizePrice}
            onChange={(e) => setNewSizePrice(e.target.value)}
            type="number"
            step="0.01"
            placeholder="Price"
            className="border rounded px-2 py-1 text-sm w-20 text-gray-900"
          />
          <button
            onClick={addSize}
            disabled={addingSize}
            className="text-xs px-3 py-1 rounded bg-gray-800 text-white font-medium disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>

      {/* Add-ons */}
      <div>
        <p className="text-sm font-semibold text-gray-900 mb-1">
          Add-ons / complements{" "}
          <span className="font-normal text-gray-500">(buyer can pick any number, extra cost)</span>
        </p>
        <div className="space-y-1 mb-2">
          {addons.map((a) =>
            editingAddonId === a.id ? (
              <div key={a.id} className="bg-gray-50 rounded px-2 py-2 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    value={editAddonName}
                    onChange={(e) => setEditAddonName(e.target.value)}
                    className="border rounded px-2 py-1 text-sm flex-1 text-gray-900"
                  />
                  <input
                    value={editAddonPrice}
                    onChange={(e) => setEditAddonPrice(e.target.value)}
                    type="number"
                    step="0.01"
                    className="border rounded px-2 py-1 text-sm w-20 text-gray-900"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setEditAddonImageFile(e.target.files?.[0] ?? null)}
                    className="text-xs text-gray-700 flex-1"
                  />
                  <button
                    onClick={() => saveAddonEdit(a.id)}
                    disabled={savingAddonId === a.id}
                    className="text-xs px-2 py-1 rounded bg-green-600 text-white font-medium disabled:opacity-40"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingAddonId(null)}
                    className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-800 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={a.id}
                className="flex items-center justify-between text-sm bg-gray-50 rounded px-2 py-1.5"
              >
                <span className="flex items-center gap-2 font-medium text-gray-900">
                  {a.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.image_url}
                      alt={a.name}
                      className="w-8 h-8 rounded object-cover"
                    />
                  ) : (
                    <span className="w-8 h-8 rounded bg-gray-200" />
                  )}
                  {a.name} — +GH₵{a.price}
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => startEditingAddon(a)}
                    className="text-blue-700 text-xs font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => removeAddon(a.id)}
                    className="text-red-600 text-xs font-semibold"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          )}
          {addons.length === 0 && <p className="text-sm text-gray-500">No add-ons added yet.</p>}
        </div>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              value={newAddonName}
              onChange={(e) => setNewAddonName(e.target.value)}
              placeholder="e.g. Extra chicken"
              className="border rounded px-2 py-1 text-sm flex-1 text-gray-900"
            />
            <input
              value={newAddonPrice}
              onChange={(e) => setNewAddonPrice(e.target.value)}
              type="number"
              step="0.01"
              placeholder="Extra cost"
              className="border rounded px-2 py-1 text-sm w-20 text-gray-900"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setNewAddonImageFile(e.target.files?.[0] ?? null)}
              className="text-xs text-gray-700 flex-1"
            />
            <button
              onClick={addAddon}
              disabled={addingAddon}
              className="text-xs px-3 py-1 rounded bg-gray-800 text-white font-medium disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}