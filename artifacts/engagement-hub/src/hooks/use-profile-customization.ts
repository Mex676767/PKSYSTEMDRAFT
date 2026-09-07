import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

export type AccessoryCatalogItem = {
  key: string;
  emoji: string;
  name: string;
  price: number;
};

export function useAccessoryCatalog() {
  return useQuery({
    queryKey: ["accessory-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accessory_catalog")
        .select("*")
        .order("price");
      if (error) throw error;
      return data as AccessoryCatalogItem[];
    },
  });
}

export function usePurchaseAccessory() {
  const { refetchProfile } = useAuth();
  return useMutation({
    mutationFn: async (accessoryKey: string) => {
      const { error } = await supabase.rpc("purchase_accessory", { accessory_key: accessoryKey });
      if (error) throw error;
    },
    onSuccess: () => refetchProfile(),
  });
}

export function useSetActiveAccessory() {
  const { refetchProfile } = useAuth();
  return useMutation({
    mutationFn: async (accessoryKey: string | null) => {
      const { error } = await supabase.rpc("set_active_accessory", { accessory_key: accessoryKey });
      if (error) throw error;
    },
    onSuccess: () => refetchProfile(),
  });
}

export function useSetActiveTitle() {
  const { refetchProfile } = useAuth();
  return useMutation({
    mutationFn: async (titleKey: string | null) => {
      const { error } = await supabase.rpc("set_active_title", { title_key: titleKey });
      if (error) throw error;
    },
    onSuccess: () => refetchProfile(),
  });
}
