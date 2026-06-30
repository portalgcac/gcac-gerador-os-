import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xknexpjapjanozsuowod.supabase.co';
const supabaseKey = 'sb_publishable_HAFcm7qicaIH-FrexVz3lQ_mqRRhurR';

const supabase = createClient(supabaseUrl, supabaseKey);

async function corrigirRecibos() {
  console.log('Iniciando correção de recibos com forma de pagamento "Pendente"...');
  
  // 1. Busca recibos com forma_pagamento = 'Pendente'
  const { data: recibos, error: fetchError } = await supabase
    .from('recibos')
    .select('id, numero, cliente_nome, forma_pagamento')
    .eq('forma_pagamento', 'Pendente');

  if (fetchError) {
    console.error('Erro ao buscar recibos:', fetchError);
    return;
  }

  console.log(`Encontrados ${recibos.length} recibos para corrigir.`);

  if (recibos.length === 0) {
    console.log('Nenhum recibo precisa de correção.');
    return;
  }

  // 2. Atualiza os recibos para 'PIX'
  for (const r of recibos) {
    console.log(`Corrigindo recibo #${r.numero} (${r.cliente_nome}) de "Pendente" para "PIX"...`);
    const { error: updateError } = await supabase
      .from('recibos')
      .update({ forma_pagamento: 'PIX' })
      .eq('id', r.id);

    if (updateError) {
      console.error(`Erro ao atualizar recibo ${r.id}:`, updateError);
    } else {
      console.log(`Recibo #${r.numero} corrigido com sucesso.`);
    }
  }

  console.log('Correção finalizada!');
}

corrigirRecibos();
