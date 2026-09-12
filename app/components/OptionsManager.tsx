"use client";

import { useEffect, useState } from "react";
import { supabase } from "../Lib/supabase";

type Option = { id: number; name: string; price: number };

type Props = {
  foodId: number;
};

export default function FoodOptionsManager({ foodId }: Props) {
  const [sizes, setSizes] = useState<Option[]>([]);
  const [addons, setAddons] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newSizeName, setNewSizeName] = useState("");
  const [newSizePrice, setNewSizePrice] = useState("");
  const [addingSize, setAddingSize] = useState(false);

  const [newAddonName, setNewAddonName] = useState("");
  const [newAddonPrice, setNewAddonPrice] = useState("");
  const [addingAddon, setAddingAddon] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: sizeData, error: sizeErr }, { data: addonData, error: addonErr }] =
      await Promise.all([
        supabase.from("food_sizes").select("id, name, price").eq("food_id", foodId).order("price"),
        supabase.from("food_addons").select("id, name, price").eq("food_id", foodId).order("price"),
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
    let active = true;

    const loadOptions = async () => {
      setLoading(true);

      const [{ data: sizeData, error: sizeErr }, { data: addonData, error: addonErr }] =
        await Promise.all([
          supabase
            .from("food_sizes")
            .select("id, name, price")
            .eq("food_id", foodId)
            .order("price"),
          supabase
            .from("food_addons")
            .select("id, name, price")
            .eq("food_id", foodId)
            .order("price"),
        ]);

      if (!active) return;

      if (sizeErr || addonErr) {
        setError(sizeErr?.message || addonErr?.message || "Could not load options");
      } else {
        setSizes(sizeData ?? []);
        setAddons(addonData ?? []);
      }

      setLoading(false);
    };

    void loadOptions();

    return () => {
      active = false;
    };
  }, [foodId]);

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

  async function removeSize(id: number) {
    const { error } = await supabase.from("food_sizes").delete().eq("id", id);
    if (error) setError(error.message);
    else setSizes((prev) => prev.filter((s) => s.id !== id));
  }

  async function addAddon() {
    const price = parseFloat(newAddonPrice);
    if (!newAddonName.trim() || isNaN(price) || price < 0) return;
    setAddingAddon(true);
    setError("");
    const { error } = await supabase
      .from("food_addons")
      .insert({ food_id: foodId, name: newAddonName.trim(), price });
    if (error) setError(error.message);
    else {
      setNewAddonName("");
      setNewAddonPrice("");
      await load();
    }
    setAddingAddon(false);
  }

  async function removeAddon(id: number) {
    const { error } = await supabase.from("food_addons").delete().eq("id", id);
    if (error) setError(error.message);
    else setAddons((prev) => prev.filter((a) => a.id !== id));
  }

  if (loading) return <p className="text-xs text-gray-400 mt-2">Loading options...</p>;

  return (
    <div className="mt-3 space-y-4 border-t pt-3">
      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Sizes */}
      <div>
        <p className="text-xs font-semibold text-gray-700 mb-1">
          Sizes <span className="font-normal text-gray-400">(buyer picks one; sets the price)</span>
        </p>
        <div className="space-y-1 mb-2">
          {sizes.map((s) => (
            <div key={s.id} className="flex items-center justify-between text-sm bg-gray-50 rounded px-2 py-1">
              <span>
                {s.name} — GH₵{s.price}
              </span>
              <button onClick={() => removeSize(s.id)} className="text-red-500 text-xs">
                Remove
              </button>
            </div>
          ))}
          {sizes.length === 0 && <p className="text-xs text-gray-400">No sizes added yet.</p>}
        </div>
        <div className="flex gap-2">
          <input
            value={newSizeName}
            onChange={(e) => setNewSizeName(e.target.value)}
            placeholder="e.g. Large"
            className="border rounded px-2 py-1 text-xs flex-1"
          />
          <input
            value={newSizePrice}
            onChange={(e) => setNewSizePrice(e.target.value)}
            type="number"
            step="0.01"
            placeholder="Price"
            className="border rounded px-2 py-1 text-xs w-20"
          />
          <button
            onClick={addSize}
            disabled={addingSize}
            className="text-xs px-3 py-1 rounded bg-gray-800 text-white disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>

      {/* Add-ons */}
      <div>
        <p className="text-xs font-semibold text-gray-700 mb-1">
          Add-ons / complements{" "}
          <span className="font-normal text-gray-400">(buyer can pick any number, extra cost)</span>
        </p>
        <div className="space-y-1 mb-2">
          {addons.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-sm bg-gray-50 rounded px-2 py-1">
              <span>
                {a.name} — +GH₵{a.price}
              </span>
              <button onClick={() => removeAddon(a.id)} className="text-red-500 text-xs">
                Remove
              </button>
            </div>
          ))}
          {addons.length === 0 && <p className="text-xs text-gray-400">No add-ons added yet.</p>}
        </div>
        <div className="flex gap-2">
          <input
            value={newAddonName}
            onChange={(e) => setNewAddonName(e.target.value)}
            placeholder="e.g. Extra chicken"
            className="border rounded px-2 py-1 text-xs flex-1"
          />
          <input
            value={newAddonPrice}
            onChange={(e) => setNewAddonPrice(e.target.value)}
            type="number"
            step="0.01"
            placeholder="Extra cost"
            className="border rounded px-2 py-1 text-xs w-20"
          />
          <button
            onClick={addAddon}
            disabled={addingAddon}
            className="text-xs px-3 py-1 rounded bg-gray-800 text-white disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}