import { useState } from "react";
import { authClient, clearAuthToken } from "@/lib/auth-client";

export function DangerZoneCard() {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isConfirmed = confirmation === "EXCLUIR";

  async function handleDelete() {
    if (!isConfirmed) return;

    setError(null);
    setLoading(true);

    try {
      const result = await authClient.deleteUser();

      if (result.error) {
        setError(result.error.message ?? "Erro ao excluir conta. Tente novamente.");
        setLoading(false);
        return;
      }

      clearAuthToken();
      window.location.reload();
    } catch {
      setError("Erro ao excluir conta. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="glass-card rounded-xl p-5 border border-error/30">
      <h2 className="text-lg font-bold text-error font-headline mb-2">
        Zona de Perigo
      </h2>

      <p className="text-sm text-on-surface-variant mb-4">
        Esta ação é irreversível. Todos os seus dados serão permanentemente
        excluídos.
      </p>

      <div className="space-y-3">
        <div>
          <label
            htmlFor="delete-confirmation"
            className="block text-sm font-medium text-on-surface mb-1"
          >
            Digite EXCLUIR para confirmar
          </label>
          <input
            id="delete-confirmation"
            type="text"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-error focus:outline-none focus:ring-1 focus:ring-error"
            placeholder="EXCLUIR"
          />
        </div>

        <button
          onClick={handleDelete}
          disabled={!isConfirmed || loading}
          className="w-full rounded-xl bg-gradient-to-br from-error to-[#ef4444] py-2.5 text-sm font-bold text-white hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] disabled:opacity-50"
        >
          {loading ? "Excluindo..." : "Excluir minha conta"}
        </button>

        {error && (
          <p className="text-sm text-error">{error}</p>
        )}
      </div>
    </div>
  );
}
