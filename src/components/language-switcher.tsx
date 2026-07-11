"use client";
import { Languages } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  return (
    <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
      <SelectTrigger className="gap-1.5 h-10" aria-label={t(`lang.${lang}`)}>
        <Languages className="size-4" />
        {/* Desktop: full label · Mobile: short code */}
        <span className="text-sm font-medium max-lg:hidden">{t(`lang.${lang}`)}</span>
        <span className="text-sm font-medium lg:hidden">{lang.toUpperCase()}</span>
      </SelectTrigger>
      <SelectContent position="popper" align="end" sideOffset={4} className="min-w-[8rem]">
        <SelectItem value="id">{t("lang.id")}</SelectItem>
        <SelectItem value="en">{t("lang.en")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
