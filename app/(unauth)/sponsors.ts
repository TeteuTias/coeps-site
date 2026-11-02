// Gerado a partir de public/cieps/patrocinadores/manifest.json (scripts/assets/process-sponsor-logos.py).
// A ordem das cotas define a hierarquia na home: Master > Diamante > Ouro > Prata > Bronze > Apoio.

export type Sponsor = { name: string; src: string; width: number; height: number };
export type SponsorTier = { id: string; label: string; sponsors: Sponsor[] };

export const sponsorTiers: SponsorTier[] = [
  {
    id: 'master',
    label: 'Patrocínio Master',
    sponsors: [
      { name: 'Medgrupo', src: '/cieps/patrocinadores/master/medgrupo.png', width: 869, height: 221 },
    ],
  },
  {
    id: 'diamante',
    label: 'Patrocínio Diamante',
    sponsors: [
      { name: 'Eliza Cardoso Serviço de Buffet', src: '/cieps/patrocinadores/diamante/eliza-cardoso.png', width: 632, height: 329 },
    ],
  },
  {
    id: 'ouro',
    label: 'Patrocínio Ouro',
    sponsors: [
      { name: 'Proformat Fotografias', src: '/cieps/patrocinadores/ouro/proformat.png', width: 1014, height: 570 },
      { name: 'Café Vasconcelos', src: '/cieps/patrocinadores/ouro/cafe-vasconcelos.png', width: 1371, height: 396 },
      { name: 'Topway Nutrition', src: '/cieps/patrocinadores/ouro/topway.png', width: 1032, height: 252 },
      { name: 'Guaraná Mineiro', src: '/cieps/patrocinadores/ouro/guarana-mineiro.png', width: 734, height: 524 },
      { name: 'Q.imagem Filmes', src: '/cieps/patrocinadores/ouro/q-imagem.png', width: 2606, height: 600 },
    ],
  },
  {
    id: 'prata',
    label: 'Patrocínio Prata',
    sponsors: [
      { name: 'Éden Estética e Bem-Estar', src: '/cieps/patrocinadores/prata/eden.png', width: 832, height: 199 },
      { name: 'Medcor Cursos e Cematri', src: '/cieps/patrocinadores/prata/medcor-cematri.png', width: 980, height: 600 },
      { name: 'Palácio de Cristal', src: '/cieps/patrocinadores/prata/palacio-de-cristal.png', width: 1065, height: 524 },
      { name: 'Unicred', src: '/cieps/patrocinadores/prata/unicred.png', width: 354, height: 54 },
      { name: 'Smart Fluency', src: '/cieps/patrocinadores/prata/smart-fluency.png', width: 1156, height: 600 },
      { name: 'Ana Godoi Decoração', src: '/cieps/patrocinadores/prata/ana-godoi.png', width: 811, height: 478 },
      { name: 'Café da Ana', src: '/cieps/patrocinadores/prata/cafe-da-ana.png', width: 1427, height: 600 },
    ],
  },
  {
    id: 'bronze',
    label: 'Patrocínio Bronze',
    sponsors: [
      { name: 'Cremiatta Sorvetes e Açaí', src: '/cieps/patrocinadores/bronze/cremiatta.png', width: 909, height: 600 },
      { name: 'Grupo Fuerza', src: '/cieps/patrocinadores/bronze/grupo-fuerza.png', width: 549, height: 600 },
      { name: 'Unimed Araguari', src: '/cieps/patrocinadores/bronze/unimed-araguari.png', width: 1679, height: 600 },
      { name: 'Livraria PHL', src: '/cieps/patrocinadores/bronze/livraria-phl.png', width: 622, height: 416 },
    ],
  },
  {
    id: 'apoio',
    label: 'Apoio',
    sponsors: [
      { name: 'Prefeitura de Araguari', src: '/cieps/patrocinadores/apoio/prefeitura-araguari.png', width: 585, height: 217 },
      { name: 'ABMLPM', src: '/cieps/patrocinadores/apoio/abmlpm.png', width: 1887, height: 600 },
      { name: 'Academia Brasileira de Neurologia - MG', src: '/cieps/patrocinadores/apoio/abn-mg.png', width: 1183, height: 288 },
      { name: 'Hospital Universitário Sagrada Família', src: '/cieps/patrocinadores/apoio/husf.png', width: 938, height: 600 },
    ],
  },
];
