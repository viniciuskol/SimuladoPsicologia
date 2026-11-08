// Carrega JSON de study/data/*.json via fetch(); se falhar (ex.: aberto direto
// como file://, onde fetch() é bloqueado no Chrome/Edge), avisa o usuário a
// usar um servidor local em vez de tentar um fallback silencioso frágil.
export async function loadJSON(relPath) {
  const res = await fetch(relPath);
  if (!res.ok) throw new Error(`Falha ao carregar ${relPath}: HTTP ${res.status}`);
  return res.json();
}

export function showFetchHelp(container) {
  container.innerHTML = `
    <div class="card">
      <h2>Não foi possível carregar os dados</h2>
      <p class="muted">Se você abriu este arquivo diretamente (duplo-clique), o navegador bloqueia o carregamento de dados locais por segurança.</p>
      <p>Abra um terminal na pasta do projeto e rode:</p>
      <pre>python3 -m http.server 8766 --directory study</pre>
      <p>Depois acesse: <code>http://localhost:8766/simulado.html</code></p>
    </div>`;
}
