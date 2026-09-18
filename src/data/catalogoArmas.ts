export interface ItemCatalogoArma {
  tipo: string;
  fabricante: string;
  modelo: string;
  calibrePadrao?: string;
}

export const CATALOGO_BASE_ARMAS: ItemCatalogoArma[] = [
  // ==========================================
  // PISTOLAS
  // ==========================================
  // TAURUS
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'G2C', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'G3', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'G3C', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'G3 TORO', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'G3C TORO', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'GX4', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'GX4 TORO', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'GX4 CARRY', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'GX4 CARRY TORO', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'TS9', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'TH9', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'TH9C', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'TH380', calibrePadrao: '.380 ACP' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'TH380C', calibrePadrao: '.380 ACP' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'TH40', calibrePadrao: '.40 S&W' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'TH40C', calibrePadrao: '.40 S&W' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'PT 92', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'PT 100', calibrePadrao: '.40 S&W' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'PT 838', calibrePadrao: '.380 ACP' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'PT 838C', calibrePadrao: '.380 ACP' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'PT 938', calibrePadrao: '.380 ACP' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'PT 58 HC PLUS', calibrePadrao: '.380 ACP' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'PT 59', calibrePadrao: '.380 ACP' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'PT 1911', calibrePadrao: '.45 ACP' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'PT 1911 9MM', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: '1911 OFFICER', calibrePadrao: '.45 ACP' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'TX22', calibrePadrao: '.22 LR' },
  { tipo: 'PISTOLA', fabricante: 'TAURUS', modelo: 'TX22 COMPACT', calibrePadrao: '.22 LR' },

  // GLOCK
  { tipo: 'PISTOLA', fabricante: 'GLOCK', modelo: 'G17 GEN5', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'GLOCK', modelo: 'G17', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'GLOCK', modelo: 'G19 GEN5', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'GLOCK', modelo: 'G19', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'GLOCK', modelo: 'G19X', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'GLOCK', modelo: 'G20', calibrePadrao: '10mm AUTO' },
  { tipo: 'PISTOLA', fabricante: 'GLOCK', modelo: 'G21', calibrePadrao: '.45 ACP' },
  { tipo: 'PISTOLA', fabricante: 'GLOCK', modelo: 'G22 GEN5', calibrePadrao: '.40 S&W' },
  { tipo: 'PISTOLA', fabricante: 'GLOCK', modelo: 'G22', calibrePadrao: '.40 S&W' },
  { tipo: 'PISTOLA', fabricante: 'GLOCK', modelo: 'G23', calibrePadrao: '.40 S&W' },
  { tipo: 'PISTOLA', fabricante: 'GLOCK', modelo: 'G25', calibrePadrao: '.380 ACP' },
  { tipo: 'PISTOLA', fabricante: 'GLOCK', modelo: 'G28', calibrePadrao: '.380 ACP' },
  { tipo: 'PISTOLA', fabricante: 'GLOCK', modelo: 'G34', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'GLOCK', modelo: 'G42', calibrePadrao: '.380 ACP' },
  { tipo: 'PISTOLA', fabricante: 'GLOCK', modelo: 'G43', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'GLOCK', modelo: 'G43X', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'GLOCK', modelo: 'G43X MOS', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'GLOCK', modelo: 'G44', calibrePadrao: '.22 LR' },
  { tipo: 'PISTOLA', fabricante: 'GLOCK', modelo: 'G45', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'GLOCK', modelo: 'G45 MOS', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'GLOCK', modelo: 'G48', calibrePadrao: '9mm LUGER' },

  // CZ (CESKA ZBROJOVKA)
  { tipo: 'PISTOLA', fabricante: 'CZ', modelo: 'P-10 C', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'CZ', modelo: 'P-10 F', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'CZ', modelo: 'P-10 S', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'CZ', modelo: 'P-10 M', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'CZ', modelo: 'CZ 75 B', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'CZ', modelo: 'CZ 75 COMPACT', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'CZ', modelo: 'CZ 75 SP-01 SHADOW', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'CZ', modelo: 'SHADOW 2', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'CZ', modelo: 'SHADOW 2 COMPACT', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'CZ', modelo: 'TS 2', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'CZ', modelo: 'P-07', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'CZ', modelo: 'P-09', calibrePadrao: '9mm LUGER' },

  // SIG SAUER
  { tipo: 'PISTOLA', fabricante: 'SIG SAUER', modelo: 'P320', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'SIG SAUER', modelo: 'P320 M17', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'SIG SAUER', modelo: 'P320 M18', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'SIG SAUER', modelo: 'P320 XFIVE', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'SIG SAUER', modelo: 'P365', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'SIG SAUER', modelo: 'P365X', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'SIG SAUER', modelo: 'P365 XL', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'SIG SAUER', modelo: 'P365 XMACRO', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'SIG SAUER', modelo: 'P226', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'SIG SAUER', modelo: 'P229', calibrePadrao: '9mm LUGER' },

  // CANIK
  { tipo: 'PISTOLA', fabricante: 'CANIK', modelo: 'TP9 SF', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'CANIK', modelo: 'TP9 SFX', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'CANIK', modelo: 'TP9 ELITE', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'CANIK', modelo: 'TP9 SUB ELITE', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'CANIK', modelo: 'SFX RIVAL', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'CANIK', modelo: 'SFX RIVAL-S', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'CANIK', modelo: 'METE SF', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'CANIK', modelo: 'METE SFT', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'CANIK', modelo: 'METE SFX', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'CANIK', modelo: 'METE MC9', calibrePadrao: '9mm LUGER' },

  // IMBEL
  { tipo: 'PISTOLA', fabricante: 'IMBEL', modelo: 'MD1', calibrePadrao: '.380 ACP' },
  { tipo: 'PISTOLA', fabricante: 'IMBEL', modelo: 'MD2', calibrePadrao: '.40 S&W' },
  { tipo: 'PISTOLA', fabricante: 'IMBEL', modelo: 'MD6', calibrePadrao: '.40 S&W' },
  { tipo: 'PISTOLA', fabricante: 'IMBEL', modelo: 'MD7', calibrePadrao: '.40 S&W' },
  { tipo: 'PISTOLA', fabricante: 'IMBEL', modelo: 'GC MD1', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'IMBEL', modelo: 'GC MD2', calibrePadrao: '.45 ACP' },
  { tipo: 'PISTOLA', fabricante: 'IMBEL', modelo: 'M1911 A1', calibrePadrao: '.45 ACP' },

  // BERETTA
  { tipo: 'PISTOLA', fabricante: 'BERETTA', modelo: 'APX', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'BERETTA', modelo: 'APX A1', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'BERETTA', modelo: 'APX CENTURION', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'BERETTA', modelo: '92FS', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'BERETTA', modelo: 'M9', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'BERETTA', modelo: 'M9A3', calibrePadrao: '9mm LUGER' },

  // SMITH & WESSON
  { tipo: 'PISTOLA', fabricante: 'SMITH & WESSON', modelo: 'M&P 9', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'SMITH & WESSON', modelo: 'M&P 9 SHIELD', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'SMITH & WESSON', modelo: 'M&P 9 SHIELD PLUS', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'SMITH & WESSON', modelo: 'M&P 40', calibrePadrao: '.40 S&W' },
  { tipo: 'PISTOLA', fabricante: 'SMITH & WESSON', modelo: 'EQUALIZER', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'SMITH & WESSON', modelo: 'BODYGUARD 380', calibrePadrao: '.380 ACP' },

  // SPRINGFIELD ARMORY
  { tipo: 'PISTOLA', fabricante: 'SPRINGFIELD ARMORY', modelo: 'HELLCAT', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'SPRINGFIELD ARMORY', modelo: 'HELLCAT PRO', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'SPRINGFIELD ARMORY', modelo: 'ECHELON', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'SPRINGFIELD ARMORY', modelo: '1911', calibrePadrao: '.45 ACP' },
  { tipo: 'PISTOLA', fabricante: 'SPRINGFIELD ARMORY', modelo: 'XD-M', calibrePadrao: '9mm LUGER' },

  // AREX
  { tipo: 'PISTOLA', fabricante: 'AREX', modelo: 'DELTA GEN 2', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'AREX', modelo: 'ZERO 1', calibrePadrao: '9mm LUGER' },

  // TANFOGLIO
  { tipo: 'PISTOLA', fabricante: 'TANFOGLIO', modelo: 'STOCK II', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'TANFOGLIO', modelo: 'STOCK III', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'TANFOGLIO', modelo: 'DEFORCE', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'TANFOGLIO', modelo: 'COMBAT', calibrePadrao: '9mm LUGER' },

  // WALTHER
  { tipo: 'PISTOLA', fabricante: 'WALTHER', modelo: 'PDP', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'WALTHER', modelo: 'PPQ', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'WALTHER', modelo: 'P22', calibrePadrao: '.22 LR' },

  // RUGER
  { tipo: 'PISTOLA', fabricante: 'RUGER', modelo: 'LCP', calibrePadrao: '.380 ACP' },
  { tipo: 'PISTOLA', fabricante: 'RUGER', modelo: 'LCP II', calibrePadrao: '.380 ACP' },
  { tipo: 'PISTOLA', fabricante: 'RUGER', modelo: 'SECURITY-9', calibrePadrao: '9mm LUGER' },
  { tipo: 'PISTOLA', fabricante: 'RUGER', modelo: 'MARK IV', calibrePadrao: '.22 LR' },

  // ==========================================
  // REVÓLVERES
  // ==========================================
  // TAURUS
  { tipo: 'REVÓLVER', fabricante: 'TAURUS', modelo: 'RT 85', calibrePadrao: '.38 SPL' },
  { tipo: 'REVÓLVER', fabricante: 'TAURUS', modelo: 'RT 85S', calibrePadrao: '.38 SPL' },
  { tipo: 'REVÓLVER', fabricante: 'TAURUS', modelo: 'RT 88', calibrePadrao: '.38 SPL' },
  { tipo: 'REVÓLVER', fabricante: 'TAURUS', modelo: 'RT 889', calibrePadrao: '.38 SPL' },
  { tipo: 'REVÓLVER', fabricante: 'TAURUS', modelo: 'RT 856', calibrePadrao: '.38 SPL' },
  { tipo: 'REVÓLVER', fabricante: 'TAURUS', modelo: 'RT 817', calibrePadrao: '.38 SPL' },
  { tipo: 'REVÓLVER', fabricante: 'TAURUS', modelo: 'RT 718', calibrePadrao: '.38 SPL' },
  { tipo: 'REVÓLVER', fabricante: 'TAURUS', modelo: 'RT 608', calibrePadrao: '.357 MAG' },
  { tipo: 'REVÓLVER', fabricante: 'TAURUS', modelo: 'RT 627 TRACKER', calibrePadrao: '.357 MAG' },
  { tipo: 'REVÓLVER', fabricante: 'TAURUS', modelo: 'RT 692', calibrePadrao: '.357 MAG' },
  { tipo: 'REVÓLVER', fabricante: 'TAURUS', modelo: 'RT 410 THE JUDGE', calibrePadrao: '36 GA' },
  { tipo: 'REVÓLVER', fabricante: 'TAURUS', modelo: 'RT 357', calibrePadrao: '.357 MAG' },
  { tipo: 'REVÓLVER', fabricante: 'TAURUS', modelo: 'RAGING BULL', calibrePadrao: '.44 MAG' },
  { tipo: 'REVÓLVER', fabricante: 'TAURUS', modelo: 'RAGING HUNTER .44', calibrePadrao: '.44 MAG' },
  { tipo: 'REVÓLVER', fabricante: 'TAURUS', modelo: 'RAGING HUNTER .357', calibrePadrao: '.357 MAG' },
  { tipo: 'REVÓLVER', fabricante: 'TAURUS', modelo: 'RT 454 CASULL', calibrePadrao: '.454 CASULL' },

  // SMITH & WESSON
  { tipo: 'REVÓLVER', fabricante: 'SMITH & WESSON', modelo: 'MODEL 686', calibrePadrao: '.357 MAG' },
  { tipo: 'REVÓLVER', fabricante: 'SMITH & WESSON', modelo: 'MODEL 629', calibrePadrao: '.44 MAG' },
  { tipo: 'REVÓLVER', fabricante: 'SMITH & WESSON', modelo: 'MODEL 19', calibrePadrao: '.357 MAG' },
  { tipo: 'REVÓLVER', fabricante: 'SMITH & WESSON', modelo: 'MODEL 60', calibrePadrao: '.357 MAG' },
  { tipo: 'REVÓLVER', fabricante: 'SMITH & WESSON', modelo: 'MODEL 29', calibrePadrao: '.44 MAG' },

  // ROSSI
  { tipo: 'REVÓLVER', fabricante: 'ROSSI', modelo: 'R972', calibrePadrao: '.357 MAG' },
  { tipo: 'REVÓLVER', fabricante: 'ROSSI', modelo: 'R851', calibrePadrao: '.38 SPL' },
  { tipo: 'REVÓLVER', fabricante: 'ROSSI', modelo: 'RP63', calibrePadrao: '.357 MAG' },
  { tipo: 'REVÓLVER', fabricante: 'ROSSI', modelo: 'RM66', calibrePadrao: '.357 MAG' },
  { tipo: 'REVÓLVER', fabricante: 'ROSSI', modelo: 'PRINCESS', calibrePadrao: '.22 LR' },

  // COLT
  { tipo: 'REVÓLVER', fabricante: 'COLT', modelo: 'PYTHON', calibrePadrao: '.357 MAG' },
  { tipo: 'REVÓLVER', fabricante: 'COLT', modelo: 'ANACONDA', calibrePadrao: '.44 MAG' },
  { tipo: 'REVÓLVER', fabricante: 'COLT', modelo: 'KING COBRA', calibrePadrao: '.357 MAG' },

  // RUGER
  { tipo: 'REVÓLVER', fabricante: 'RUGER', modelo: 'GP100', calibrePadrao: '.357 MAG' },
  { tipo: 'REVÓLVER', fabricante: 'RUGER', modelo: 'SP101', calibrePadrao: '.357 MAG' },
  { tipo: 'REVÓLVER', fabricante: 'RUGER', modelo: 'REDHAWK', calibrePadrao: '.44 MAG' },

  // ==========================================
  // CARABINAS / FUZIS
  // ==========================================
  // TAURUS
  { tipo: 'CARABINA / FUZIL', fabricante: 'TAURUS', modelo: 'T4', calibrePadrao: '.223 REM / 5.56 NATO' },
  { tipo: 'CARABINA / FUZIL', fabricante: 'TAURUS', modelo: 'CTT40', calibrePadrao: '.40 S&W' },
  { tipo: 'CARABINA / FUZIL', fabricante: 'TAURUS', modelo: 'T9', calibrePadrao: '9mm LUGER' },

  // CBC
  { tipo: 'CARABINA / FUZIL', fabricante: 'CBC', modelo: '7022', calibrePadrao: '.22 LR' },
  { tipo: 'CARABINA / FUZIL', fabricante: 'CBC', modelo: '8122', calibrePadrao: '.22 LR' },
  { tipo: 'CARABINA / FUZIL', fabricante: 'CBC', modelo: 'RIO BRAVO', calibrePadrao: '.22 LR' },
  { tipo: 'CARABINA / FUZIL', fabricante: 'CBC', modelo: 'DELTA', calibrePadrao: '.22 LR' },
  { tipo: 'CARABINA / FUZIL', fabricante: 'CBC', modelo: '122', calibrePadrao: '.22 LR' },

  // ROSSI
  { tipo: 'CARABINA / FUZIL', fabricante: 'ROSSI', modelo: 'PUMA .357', calibrePadrao: '.357 MAG' },
  { tipo: 'CARABINA / FUZIL', fabricante: 'ROSSI', modelo: 'PUMA .38', calibrePadrao: '.38 SPL' },
  { tipo: 'CARABINA / FUZIL', fabricante: 'ROSSI', modelo: 'PUMA .44', calibrePadrao: '.44 MAG' },
  { tipo: 'CARABINA / FUZIL', fabricante: 'ROSSI', modelo: 'GALLERY', calibrePadrao: '.22 LR' },

  // IMBEL
  { tipo: 'CARABINA / FUZIL', fabricante: 'IMBEL', modelo: 'IA2 5.56', calibrePadrao: '.223 REM / 5.56 NATO' },
  { tipo: 'CARABINA / FUZIL', fabricante: 'IMBEL', modelo: 'IA2 7.62', calibrePadrao: '.308 WIN / 7.62 NATO' },
  { tipo: 'CARABINA / FUZIL', fabricante: 'IMBEL', modelo: 'FAL', calibrePadrao: '.308 WIN / 7.62 NATO' },
  { tipo: 'CARABINA / FUZIL', fabricante: 'IMBEL', modelo: 'MD97', calibrePadrao: '.223 REM / 5.56 NATO' },

  // RUGER
  { tipo: 'CARABINA / FUZIL', fabricante: 'RUGER', modelo: '10/22', calibrePadrao: '.22 LR' },
  { tipo: 'CARABINA / FUZIL', fabricante: 'RUGER', modelo: 'AR-556', calibrePadrao: '.223 REM / 5.56 NATO' },
  { tipo: 'CARABINA / FUZIL', fabricante: 'RUGER', modelo: 'PRECISION RIFLE', calibrePadrao: '.308 WIN / 7.62 NATO' },
  { tipo: 'CARABINA / FUZIL', fabricante: 'RUGER', modelo: 'AMERICAN RIFLE', calibrePadrao: '.308 WIN / 7.62 NATO' },

  // SMITH & WESSON
  { tipo: 'CARABINA / FUZIL', fabricante: 'SMITH & WESSON', modelo: 'M&P 15', calibrePadrao: '.223 REM / 5.56 NATO' },
  { tipo: 'CARABINA / FUZIL', fabricante: 'SMITH & WESSON', modelo: 'M&P 15-22', calibrePadrao: '.22 LR' },

  // CZ
  { tipo: 'CARABINA / FUZIL', fabricante: 'CZ', modelo: 'SCORPION EVO 3', calibrePadrao: '9mm LUGER' },
  { tipo: 'CARABINA / FUZIL', fabricante: 'CZ', modelo: 'CZ 457', calibrePadrao: '.22 LR' },
  { tipo: 'CARABINA / FUZIL', fabricante: 'CZ', modelo: 'CZ 600', calibrePadrao: '.308 WIN / 7.62 NATO' },

  // WINCHESTER / REMINGTON
  { tipo: 'CARABINA / FUZIL', fabricante: 'WINCHESTER', modelo: 'MODEL 70', calibrePadrao: '.308 WIN / 7.62 NATO' },
  { tipo: 'CARABINA / FUZIL', fabricante: 'WINCHESTER', modelo: 'WILDCAT', calibrePadrao: '.22 LR' },
  { tipo: 'CARABINA / FUZIL', fabricante: 'REMINGTON', modelo: '700', calibrePadrao: '.308 WIN / 7.62 NATO' },

  // ==========================================
  // ESPINGARDAS
  // ==========================================
  // CBC
  { tipo: 'ESPINGARDA', fabricante: 'CBC', modelo: 'PUMP MILITARY 3.0', calibrePadrao: '12 GA' },
  { tipo: 'ESPINGARDA', fabricante: 'CBC', modelo: 'PUMP TACTICAL', calibrePadrao: '12 GA' },

  // BOITO
  { tipo: 'ESPINGARDA', fabricante: 'BOITO', modelo: 'MIURA I', calibrePadrao: '12 GA' },
  { tipo: 'ESPINGARDA', fabricante: 'BOITO', modelo: 'MIURA II', calibrePadrao: '12 GA' },
  { tipo: 'ESPINGARDA', fabricante: 'BOITO', modelo: 'REÚNA 12GA', calibrePadrao: '12 GA' },
  { tipo: 'ESPINGARDA', fabricante: 'BOITO', modelo: 'REÚNA 20GA', calibrePadrao: '20 GA' },
  { tipo: 'ESPINGARDA', fabricante: 'BOITO', modelo: 'REÚNA 28GA', calibrePadrao: '28 GA' },
  { tipo: 'ESPINGARDA', fabricante: 'BOITO', modelo: 'REÚNA 36GA', calibrePadrao: '36 GA' },
  { tipo: 'ESPINGARDA', fabricante: 'BOITO', modelo: 'ERA 2001', calibrePadrao: '12 GA' },
  { tipo: 'ESPINGARDA', fabricante: 'BOITO', modelo: 'PUMP', calibrePadrao: '12 GA' },
  { tipo: 'ESPINGARDA', fabricante: 'BOITO', modelo: 'A-680', calibrePadrao: '12 GA' },

  // BENELLI / BERETTA / STOEGER / MOSSBERG
  { tipo: 'ESPINGARDA', fabricante: 'BENELLI', modelo: 'SUPERNOVA', calibrePadrao: '12 GA' },
  { tipo: 'ESPINGARDA', fabricante: 'BENELLI', modelo: 'M4', calibrePadrao: '12 GA' },
  { tipo: 'ESPINGARDA', fabricante: 'BENELLI', modelo: 'M2', calibrePadrao: '12 GA' },
  { tipo: 'ESPINGARDA', fabricante: 'STOEGER', modelo: 'M3000', calibrePadrao: '12 GA' },
  { tipo: 'ESPINGARDA', fabricante: 'BERETTA', modelo: 'A400', calibrePadrao: '12 GA' },
  { tipo: 'ESPINGARDA', fabricante: 'BERETTA', modelo: 'DT11', calibrePadrao: '12 GA' },
  { tipo: 'ESPINGARDA', fabricante: 'BERETTA', modelo: '1301 TACTICAL', calibrePadrao: '12 GA' },
  { tipo: 'ESPINGARDA', fabricante: 'MOSSBERG', modelo: '500', calibrePadrao: '12 GA' },
  { tipo: 'ESPINGARDA', fabricante: 'MOSSBERG', modelo: '590', calibrePadrao: '12 GA' },
  { tipo: 'ESPINGARDA', fabricante: 'MOSSBERG', modelo: 'MAVERICK 88', calibrePadrao: '12 GA' }
];

export function normalizarTipoArma(tipo?: string | null): string {
  if (!tipo) return '';
  const t = tipo.trim().toUpperCase();
  if (t.includes('PISTOLA')) return 'PISTOLA';
  if (t.includes('REV') || t.includes('VOLVER')) return 'REVÓLVER';
  if (t.includes('CARABINA') || t.includes('FUZIL')) return 'CARABINA / FUZIL';
  if (t.includes('ESPINGARDA')) return 'ESPINGARDA';
  return t;
}
