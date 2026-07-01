import { CategoriaServico } from '../types';

/**
 * Verifica se uma categoria se comporta como "Laudo" (ou seja, não é receita/honorário da empresa,
 * é paga diretamente a terceiros/instrutores).
 */
export function isLaudoExame(categoriaNome: string, categoriasConfig?: CategoriaServico[]): boolean {
  const nomeLimpo = (categoriaNome || '').trim().toUpperCase();
  if (!nomeLimpo) return false;

  const cats = categoriasConfig || [
    { id: 'honorario', nome: 'Honorário', calculaComoServico: true },
    { id: 'laudo', nome: 'Laudo', calculaComoServico: false }
  ];

  const cat = cats.find(c => (c.nome || '').trim().toUpperCase() === nomeLimpo);
  if (cat) {
    return !cat.calculaComoServico;
  }

  // Fallback para manter retrocompatibilidade caso a categoria não seja encontrada
  return nomeLimpo === 'LAUDO';
}

/**
 * Retorna o rótulo de exibição amigável e em caixa alta da categoria.
 */
export function obterRotuloCategoria(categoriaNome: string): string {
  const nomeLimpo = (categoriaNome || '').trim().toUpperCase();
  if (nomeLimpo === 'HONORÁRIO' || nomeLimpo === 'HONORARIO') {
    return 'HONORÁRIO / SERVIÇO';
  }
  if (nomeLimpo === 'LAUDO') {
    return 'LAUDO / EXAME EXTERNO';
  }
  return nomeLimpo;
}
