import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBatchStore } from "@/stores/batch-store";
import { fetchImageTypes } from "@/lib/api";

type ImageType = {
  id: string;
  displayName: string;
  typeKey: string;
};

export function BatchReviewTable() {
  const { images, updateImage, batchStep } = useBatchStore();
  const [sortAsc, setSortAsc] = useState(true);

  const { data: typesData } = useQuery<{ types: ImageType[] }>({
    queryKey: ["image-types"],
    queryFn: fetchImageTypes,
  });

  if (batchStep !== "reviewed" && batchStep !== "completed") return null;

  const sorted = [...images]
    .map((img, idx) => ({ ...img, originalIndex: idx }))
    .filter((img) => img.qualityScore !== null)
    .sort((a, b) => sortAsc
      ? (a.qualityScore || 0) - (b.qualityScore || 0)
      : (b.qualityScore || 0) - (a.qualityScore || 0)
    );

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-semibold text-on-surface font-headline">Revisão Individual</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant/20 text-left">
              <th className="pb-2 text-xs text-on-surface-variant font-medium">Arquivo</th>
              <th
                className="pb-2 text-xs text-on-surface-variant font-medium cursor-pointer hover:text-primary"
                onClick={() => setSortAsc(!sortAsc)}
              >
                Score {sortAsc ? "↑" : "↓"}
              </th>
              <th className="pb-2 text-xs text-on-surface-variant font-medium">Tipo Sugerido</th>
              <th className="pb-2 text-xs text-on-surface-variant font-medium">Tipo Selecionado</th>
              <th className="pb-2 text-xs text-on-surface-variant font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((img) => (
              <tr key={img.originalIndex} className={`border-b border-outline-variant/10 ${(img.qualityScore || 0) < 5 ? "bg-error/5" : ""}`}>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <img src={URL.createObjectURL(img.file)} alt="" className="h-8 w-8 rounded object-cover" />
                    <span className="text-on-surface truncate max-w-[120px]">{img.file.name}</span>
                  </div>
                </td>
                <td className="py-2 pr-3">
                  <span className={`font-bold ${(img.qualityScore || 0) >= 7 ? "text-success" : (img.qualityScore || 0) >= 5 ? "text-warning" : "text-error"}`}>
                    {img.qualityScore}/10
                  </span>
                </td>
                <td className="py-2 pr-3 text-on-surface-variant text-xs">
                  {img.analysis?.suggested_type?.display_name || "—"}
                </td>
                <td className="py-2 pr-3">
                  <select
                    value={img.selectedTypeId || ""}
                    onChange={(e) => updateImage(img.originalIndex, { selectedTypeId: e.target.value || null })}
                    className="rounded bg-surface-container-low border border-outline-variant/20 px-2 py-1 text-xs text-on-surface"
                  >
                    <option value="">Auto (IA)</option>
                    {typesData?.types?.map((t: ImageType) => (
                      <option key={t.id} value={t.id}>{t.displayName}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    img.status === "processed" ? "bg-success-container text-success"
                    : img.status === "error" ? "bg-error/20 text-error"
                    : "bg-surface-container-high text-on-surface-variant"
                  }`}>
                    {img.status === "analyzed" ? "Analisado" : img.status === "processed" ? "Processado" : img.status === "error" ? "Erro" : img.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
