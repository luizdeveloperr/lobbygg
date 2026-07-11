const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

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
      ...options 
    });

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Comando falhou com código ${code}`));
    });
  });
}

function runInstall(stepLabel, cwd, args) {
  console.log(`\n${stepLabel}`);
  execSync(`${npmCommand} ${args.join(' ')}`, {
    stdio: 'inherit',
    cwd,
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
    runInstall('[1/4] Instalando dependências do projeto...', __dirname, ['install', '--include=dev']);
    if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
      throw new Error('As dependências da raiz não foram instaladas corretamente.');
    }

    // 2. Instalar dependências do Servidor
    runInstall('[2/4] Instalando dependências do servidor...', path.join(__dirname, 'server'), ['install']);
    if (!fs.existsSync(path.join(__dirname, 'server', 'node_modules'))) {
      throw new Error('As dependências do servidor não foram instaladas corretamente.');
    }

    // 3. Gerar o Build do Frontend
    console.log('\n[3/4] Gerando build do frontend (Vite)...');
    await runCommand(npmCommand, ['run', 'build'], { cwd: __dirname });

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
      cwd: __dirname,
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
