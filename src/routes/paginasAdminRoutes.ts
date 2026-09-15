import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { validateAttendantAccess } from '../lib/auth';

export async function paginasAdminRoutes(fastify: FastifyInstance) {
  fastify.get('/atendente/painel', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Painel do Atendente - Mobvalor</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              padding: 20px;
            }

            .container {
              max-width: 1200px;
              margin: 0 auto;
            }

            .header {
              background: white;
              padding: 20px;
              border-radius: 10px;
              margin-bottom: 30px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }

            .header h1 {
              color: #333;
              margin-bottom: 10px;
            }

            .header p {
              color: #666;
              font-size: 14px;
            }

            .fila-container {
              background: white;
              border-radius: 10px;
              padding: 20px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }

            .fila-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
              border-bottom: 2px solid #f0f0f0;
              padding-bottom: 15px;
            }

            .fila-header h2 {
              color: #333;
            }

            .badge {
              background: #667eea;
              color: white;
              padding: 5px 15px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: bold;
            }

            .fila-item {
              background: #f8f9fa;
              border-left: 4px solid #667eea;
              padding: 15px;
              margin-bottom: 15px;
              border-radius: 5px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }

            .fila-item.expandido {
              background: #fff;
              border: 2px solid #667eea;
              display: block;
            }

            .fila-info h3 {
              color: #333;
              margin-bottom: 5px;
            }

            .fila-info p {
              color: #666;
              font-size: 13px;
              margin: 3px 0;
            }

            .placa {
              font-size: 24px;
              font-weight: bold;
              color: #667eea;
              background: #f0f0f0;
              padding: 10px 15px;
              border-radius: 5px;
              font-family: 'Courier New', monospace;
            }

            .acoes {
              display: flex;
              gap: 10px;
            }

            .btn {
              padding: 10px 15px;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              font-size: 13px;
              font-weight: 600;
              transition: all 0.3s;
            }

            .btn-processar {
              background: #667eea;
              color: white;
            }

            .btn-processar:hover {
              background: #5568d3;
              transform: scale(1.05);
            }

            .btn-detalhes {
              background: #e3f2fd;
              color: #667eea;
            }

            .btn-detalhes:hover {
              background: #bbdefb;
            }

            .formulario-entrada {
              display: none;
              background: #f0f0f0;
              padding: 15px;
              border-radius: 5px;
              margin-top: 15px;
            }

            .formulario-entrada.ativo {
              display: block;
            }

            .form-group {
              margin-bottom: 15px;
            }

            .form-group label {
              display: block;
              margin-bottom: 5px;
              color: #333;
              font-weight: 600;
              font-size: 13px;
            }

            .form-group input {
              width: 100%;
              padding: 10px;
              border: 1px solid #ddd;
              border-radius: 5px;
              font-size: 13px;
            }

            .form-actions {
              display: flex;
              gap: 10px;
              margin-top: 15px;
            }

            .btn-enviar {
              flex: 1;
              background: #4caf50;
              color: white;
              padding: 12px;
              border-radius: 5px;
              cursor: pointer;
              font-weight: 600;
            }

            .btn-enviar:hover {
              background: #45a049;
            }

            .btn-cancelar {
              flex: 1;
              background: #f44336;
              color: white;
              padding: 12px;
              border-radius: 5px;
              cursor: pointer;
              font-weight: 600;
            }

            .btn-cancelar:hover {
              background: #da190b;
            }

            .mensagem {
              padding: 15px;
              border-radius: 5px;
              margin-bottom: 20px;
              display: none;
            }

            .mensagem.sucesso {
              background: #c8e6c9;
              color: #2e7d32;
              display: block;
            }

            .mensagem.erro {
              background: #ffcdd2;
              color: #c62828;
              display: block;
            }

            .vazio {
              text-align: center;
              padding: 40px;
              color: #999;
            }

            .loading {
              text-align: center;
              padding: 20px;
              color: #667eea;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚗 Painel do Atendente - Mobvalor</h1>
              <p>Gerenciar consultas completas e entregas de resultados</p>
            </div>

            <div class="fila-container">
              <div class="fila-header">
                <h2>📋 Fila de Consultas</h2>
                <span class="badge" id="total-consultas">0 consultas</span>
              </div>

              <div id="mensagem-status" class="mensagem"></div>

              <div id="fila-consultas" class="fila-consultas">
                <div class="loading">Carregando consultas...</div>
              </div>
            </div>
          </div>

          <script>
            const API_URL = 'http://localhost:3000/api';
            const ATTENDANT_TOKEN = localStorage.getItem('attendant_token') || 'attendant_token_123456';

            async function carregarConsultas() {
              try {
                console.log('Carregando consultas...');
                const response = await fetch(\`\${API_URL}/atendente/consultas-completas/pendentes\`, {
                  headers: {
                    'Authorization': \`Bearer \${ATTENDANT_TOKEN}\`,
                  }
                });

                if (!response.ok) {
                  throw new Error(\`Erro: \${response.status}\`);
                }

                const data = await response.json();
                console.log('Consultas carregadas:', data);

                const filaDiv = document.getElementById('fila-consultas');
                const badgeDiv = document.getElementById('total-consultas');

                badgeDiv.textContent = \`\${data.dados?.length || 0} consultas\`;

                if (!data.dados || data.dados.length === 0) {
                  filaDiv.innerHTML = '<div class="vazio">Nenhuma consulta pendente 🎉</div>';
                  return;
                }

                filaDiv.innerHTML = data.dados.map(consulta => \`
                  <div class="fila-item" id="consulta-\${consulta.id}">
                    <div class="fila-info">
                      <h3>
                        <span class="placa">\${consulta.placa}</span>
                      </h3>
                      <p>👤 <strong>\${consulta.dealer.name}</strong></p>
                      <p>📱 \${consulta.dealer.whatsapp}</p>
                      <p>📧 \${consulta.dealer.email}</p>
                      <p>🕐 \${new Date(consulta.createdAt).toLocaleString('pt-BR')}</p>
                    </div>
                    <div class="acoes">
                      <button class="btn btn-detalhes" onclick="mostrarDetalhes('\${consulta.id}')">📋 Detalhes</button>
                      <button class="btn btn-processar" onclick="abrirFormularioEntrega('\${consulta.id}')">✅ Processar</button>
                    </div>
                    <div class="formulario-entrada" id="form-\${consulta.id}">
                      <div class="form-group">
                        <label>🔗 Link do Relatório Anycar:</label>
                        <input type="url" id="link-\${consulta.id}" placeholder="https://relatorios.anycar.com/..." required>
                      </div>
                      <div class="form-actions">
                        <button class="btn-enviar" onclick="entregarConsulta('\${consulta.id}')">📤 Entregar</button>
                        <button class="btn-cancelar" onclick="fecharFormulario('\${consulta.id}')">❌ Cancelar</button>
                      </div>
                    </div>
                  </div>
                \`).join('');
              } catch (error) {
                console.error('Erro ao carregar:', error);
                const filaDiv = document.getElementById('fila-consultas');
                filaDiv.innerHTML = \`<div class="vazio" style="color: red;">Erro ao carregar consultas: \${error.message}</div>\`;
              }
            }

            function abrirFormularioEntrega(consultaId) {
              const form = document.getElementById(\`form-\${consultaId}\`);
              form.classList.add('ativo');
            }

            function fecharFormulario(consultaId) {
              const form = document.getElementById(\`form-\${consultaId}\`);
              form.classList.remove('ativo');
            }

            async function entregarConsulta(consultaId) {
              const linkInput = document.getElementById(\`link-\${consultaId}\`);
              const link = linkInput.value.trim();

              if (!link) {
                mostrarMensagem('Por favor, insira o link do relatório Anycar', 'erro');
                return;
              }

              try {
                console.log('Entregando consulta...');
                const response = await fetch(\`\${API_URL}/atendente/consultas-completas/\${consultaId}/entregar\`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': \`Bearer \${ATTENDANT_TOKEN}\`,
                  },
                  body: JSON.stringify({ linkAnycar: link })
                });

                const data = await response.json();

                if (!response.ok) {
                  throw new Error(data.mensagem || 'Erro ao entregar');
                }

                mostrarMensagem('✅ Consulta entregue com sucesso! PDF enviado ao cliente.', 'sucesso');
                fecharFormulario(consultaId);

                setTimeout(() => {
                  carregarConsultas();
                }, 1500);
              } catch (error) {
                console.error('Erro:', error);
                mostrarMensagem(\`❌ Erro: \${error.message}\`, 'erro');
              }
            }

            async function mostrarDetalhes(consultaId) {
              try {
                const response = await fetch(\`\${API_URL}/atendente/consultas-completas/\${consultaId}\`, {
                  headers: {
                    'Authorization': \`Bearer \${ATTENDANT_TOKEN}\`,
                  }
                });

                const data = await response.json();
                alert(\`Detalhes da Consulta:\n\nPlaca: \${data.dados.placa}\nStatus: \${data.dados.status}\nCusto: R$ \${data.dados.custo}\nCriada em: \${new Date(data.dados.createdAt).toLocaleString('pt-BR')}\`)
              } catch (error) {
                alert('Erro ao carregar detalhes: ' + error.message);
              }
            }

            function mostrarMensagem(texto, tipo) {
              const div = document.getElementById('mensagem-status');
              div.textContent = texto;
              div.className = \`mensagem \${tipo}\`;

              setTimeout(() => {
                div.className = 'mensagem';
              }, 5000);
            }

            carregarConsultas();
            setInterval(carregarConsultas, 10000);
          </script>
        </body>
        </html>
      `;

      return reply.header('Content-Type', 'text/html; charset=utf-8').send(html);
    } catch (error: any) {
      return reply.status(500).send({
        sucesso: false,
        mensagem: 'Erro ao carregar painel',
        detalhe: error.message,
      });
    }
  });
}
