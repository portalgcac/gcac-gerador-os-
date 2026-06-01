-- Migração para formatar CPFs não-formatados (sem pontuação) no formato padrão '000.000.000-00'
-- Esta operação é segura, previne perda de dados e lida com perdas de zeros à esquerda decorrentes de importações do Excel.

CREATE OR REPLACE FUNCTION format_cpf_clean(raw_cpf TEXT) RETURNS TEXT AS $$
DECLARE
  clean_cpf TEXT;
BEGIN
  -- Se for nulo, vazio ou hífen padrão, retorna sem mexer
  IF raw_cpf IS NULL OR raw_cpf = '' OR raw_cpf = '—' THEN
    RETURN raw_cpf;
  END IF;
  
  -- Remove qualquer caractere que não seja dígito numérico
  clean_cpf := regexp_replace(raw_cpf, '\D', '', 'g');
  
  -- Se o comprimento for menor que 9 ou maior que 11, retorna o original por segurança
  -- (evitando formatar incorretamente números de telefone, passaportes ou dados corrompidos)
  IF length(clean_cpf) < 9 OR length(clean_cpf) > 11 THEN
    RETURN raw_cpf;
  END IF;
  
  -- Preenche com zeros à esquerda se o CPF perdeu dígitos (muito comum em imports de planilhas Excel)
  clean_cpf := lpad(clean_cpf, 11, '0');
  
  -- Formata no padrão 000.000.000-00
  RETURN substring(clean_cpf from 1 for 3) || '.' ||
         substring(clean_cpf from 4 for 3) || '.' ||
         substring(clean_cpf from 7 for 3) || '-' ||
         substring(clean_cpf from 10 for 2);
END;
$$ LANGUAGE plpgsql;

-- 1. Atualizar a tabela de clientes
UPDATE clientes
SET cpf = format_cpf_clean(cpf)
WHERE cpf IS NOT NULL 
  AND cpf != '—' 
  AND cpf != '' 
  AND cpf != format_cpf_clean(cpf);

-- 2. Atualizar a tabela de ordens de serviço
UPDATE ordens
SET cpf = format_cpf_clean(cpf)
WHERE cpf IS NOT NULL 
  AND cpf != '—' 
  AND cpf != '' 
  AND cpf != format_cpf_clean(cpf);

-- 3. Atualizar a tabela de recibos
UPDATE recibos
SET cliente_cpf = format_cpf_clean(cliente_cpf)
WHERE cliente_cpf IS NOT NULL 
  AND cliente_cpf != '—' 
  AND cliente_cpf != '' 
  AND cliente_cpf != format_cpf_clean(cliente_cpf);

-- 4. Atualizar a tabela de agendamentos
UPDATE agendamentos
SET cliente_cpf = format_cpf_clean(cliente_cpf)
WHERE cliente_cpf IS NOT NULL 
  AND cliente_cpf != '—' 
  AND cliente_cpf != '' 
  AND cliente_cpf != format_cpf_clean(cliente_cpf);

-- Remove a função temporária após a conclusão
DROP FUNCTION format_cpf_clean(TEXT);
