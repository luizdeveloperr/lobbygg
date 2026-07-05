const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Script Unificado de Inicialização (Produção/Hospedagem)
 * Este script automatiza:
 * 1. Instalação de dependências (Raiz e Servidor)
 * 2. Build do Frontend (React/Vite)
 * 3. Inicialização do Servidor (Express) que serve o site completo
 */

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`[🚀] Executando: ${command} ${args.join(' ')}`);
    const child = spawn(command, args, { 
      stdio: 'inherit', 
      shell: true,
      ...options 
    });

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Comando falhou com código ${code}`));
    });
  });
}

async function start() {
  try {
    console.log('\n--- 🛠️  INICIANDO PROCESSO DE SETUP ---');

    // 0. Limpar build anterior
    console.log('\n[0/4] Limpando build anterior...');
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      fs.rmSync(distPath, { recursive: true, force: true });
      console.log('✅ Pasta "dist" removida.');
    }

    // 1. Instalar dependências da Raiz
    console.log('\n[1/4] Instalando dependências do projeto...');
    // Adicionado --no-bin-links e --ignore-scripts para evitar erros de permissão/SWC em alguns dashboards
    execSync('npm install --include=dev', { stdio: 'inherit' });

    // 2. Instalar dependências do Servidor
    console.log('\n[2/4] Instalando dependências do servidor...');
    execSync('cd server && npm install', { stdio: 'inherit' });

    // 3. Gerar o Build do Frontend
    console.log('\n[3/4] Gerando build do frontend (Vite)...');
    await runCommand('npm', ['run', 'build']);

    // Verificação da pasta dist
    if (!fs.existsSync(path.join(__dirname, 'dist'))) {
      throw new Error('Erro: Pasta "dist" não foi gerada. O build falhou.');
    }

    // 4. Iniciar o Backend
    console.log('\n[4/4] Iniciando o ecossistema (Backend + Frontend)...');
    console.log('--------------------------------------------------');
    console.log('✅ SITE PRONTO! Acesse a porta configurada no dashboard.');
    console.log('--------------------------------------------------\n');

    // Inicia o processo do servidor e garante que as variáveis de ambiente atuais sejam passadas
    const server = spawn('node', ['server/index.js'], { 
      stdio: 'inherit',
      shell: true,
      env: { ...process.env }
    });

    server.on('close', (code) => {
      console.log(`[🛑] Servidor encerrado (Código: ${code})`);
      process.exit(code);
    });

  } catch (error) {
    console.error('\n❌ ERRO DURANTE A INICIALIZAÇÃO:');
    console.error(error.message);
    process.exit(1);
  }
}

start();
