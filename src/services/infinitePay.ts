import axios from 'axios';
import { supabase } from '../config/supabase';

export type TipoPacote = 'RENAVE_10' | 'RENAVE_25' | 'LEILAO_5';

type Pacote = {
  valor: number;
  creditos: number;
  saldo: 'saldo_renave_on' | 'saldo_leilao_check';
};

export type CobrancaPix = {
  order_nsu: string;
  link_pagamento: string;
  pix_copia_e_cola: string;
  valor: number;
};

const PACOTES: Record<TipoPacote, Pacote> = {
  RENAVE_10: { valor: 114.90, creditos: 10, saldo: 'saldo_renave_on' },
  RENAVE_25: { valor: 249.00, creditos: 25, saldo: 'saldo_renave_on' },
  LEILAO_5: { valor: 99.50, creditos: 5, saldo: 'saldo_leilao_check' },
};

const infinitePay = {
  async gerarCobrancaPix(tenantId: string, tipoPacote: TipoPacote): Promise<CobrancaPix> {
    const pacote = PACOTES[tipoPacote];
    const orderNsu = `MOB-${Date.now()}-${tenantId.slice(0, 4)}`;

    const recarga = await supabase.from('recargas').insert({
      tenant_id: tenantId,
      pacote_tipo: tipoPacote,
      quantidade_creditos: pacote.creditos,
      valor: pacote.valor,
      order_nsu: orderNsu,
      status: 'PENDING',
    }).select('id').single();

    if (recarga.error) throw recarga.error;

    const apiKey = process.env.INFINITEPAY_API_KEY;
    if (!apiKey) {
      return {
        order_nsu: orderNsu,
        link_pagamento: `https://mock.infinitepay.local/checkout/${orderNsu}`,
        pix_copia_e_cola: `00020126580014BR.GOV.BCB.PIX0136${orderNsu}520400005303986540${pacote.valor.toFixed(2)}5802BR5913MOBVALOR6009SAO PAULO62070503***6304MOCK`,
        valor: pacote.valor,
      };
    }

    const { data } = await axios.post(process.env.INFINITEPAY_API_URL ?? 'https://api.infinitepay.io/v2/checkouts', {
      order_nsu: orderNsu,
      amount: Math.round(pacote.valor * 100),
      description: `Mobvalor ${tipoPacote}`,
    }, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 15000,
    });

    return {
      order_nsu: orderNsu,
      link_pagamento: data.link_pagamento ?? data.url ?? data.checkout_url,
      pix_copia_e_cola: data.pix_copia_e_cola ?? data.pix_code ?? data.qr_code,
      valor: pacote.valor,
    };
  },
};

export { PACOTES };
export default infinitePay;
