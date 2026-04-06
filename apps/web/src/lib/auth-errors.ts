const errorMap: Record<string, string> = {
  // Sign in / Sign up
  "Invalid email or password": "E-mail ou senha inválidos",
  "Invalid email": "E-mail inválido",
  "Invalid email address": "E-mail inválido",
  "Invalid password": "Senha inválida",
  "User already exists": "Este e-mail já está em uso",
  "Failed to create user": "Erro ao criar conta",
  "Failed to create session": "Erro ao iniciar sessão",

  // Email verification
  "Email not verified": "E-mail não verificado",
  "Email already verified": "E-mail já verificado",
  "Email mismatch": "E-mail não corresponde",

  // Password
  "Password too short": "Senha muito curta",
  "Password too long": "Senha muito longa",
  "Credential account not found": "Conta não encontrada",

  // Token / Session
  "Invalid token": "Token inválido",
  "Token expired": "Token expirado",
  "Session expired": "Sessão expirada",
  "User not found": "Usuário não encontrado",

  // Rate limiting
  "Too many requests. Please try again later.":
    "Muitas tentativas. Tente novamente mais tarde.",

  // Generic
  Unauthorized: "Não autorizado",
  "Internal Server Error": "Erro interno do servidor",
};

export function translateAuthError(message: string): string {
  if (errorMap[message]) return errorMap[message];

  const prefixMatch = message.match(/^\[[\w.]+\]\s+(.+)$/);
  if (prefixMatch) {
    const cleaned = prefixMatch[1];
    return errorMap[cleaned] ?? cleaned;
  }

  return message;
}
