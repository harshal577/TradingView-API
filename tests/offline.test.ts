import { describe, it, expect } from 'vitest';
import TradingView from '../main';
import quoteSessionGenerator from '../src/quote/session';
import chartSessionGenerator from '../src/chart/session';

function createBridge() {
  const sent: [string, any[]][] = [];
  const bridge = {
    sessions: {} as Record<string, { onData: (packet: any) => any }>,
    send: (t: string, p: any[]) => { sent.push([t, p]); },
  };
  return { bridge, sent };
}

describe('Quote market listeners (offline)', () => {
  it('re-subscribes a symbol after its only market was closed', () => {
    const { bridge, sent } = createBridge();
    const quoteSession = new (quoteSessionGenerator(bridge))();

    new quoteSession.Market('BINANCE:BTCUSDT').close();
    sent.length = 0;
    new quoteSession.Market('BINANCE:BTCUSDT');

    expect(sent.map(([t]) => t)).toEqual(['quote_add_symbols']);
  });

  it('unsubscribes a symbol when its last market is closed', () => {
    const { bridge, sent } = createBridge();
    const quoteSession = new (quoteSessionGenerator(bridge))();

    const first = new quoteSession.Market('NASDAQ:AAPL');
    const second = new quoteSession.Market('NASDAQ:AAPL');
    sent.length = 0;

    first.close();
    expect(sent).toEqual([]);

    second.close();
    second.close();
    expect(sent.map(([t]) => t)).toEqual(['quote_remove_symbols']);
  });
});

describe('Chart study packets (offline)', () => {
  it('handles a study update without "ns" data', async () => {
    const { bridge, sent } = createBridge();
    const chart = new (chartSessionGenerator(bridge))();
    const study = new chart.Study(new TradingView.BuiltInIndicator('Volume@tv-basicstudies-241'));

    const chartID = Object.keys(bridge.sessions).find((id) => id.startsWith('cs_'));
    const studyID = sent.find(([t]) => t === 'create_study')[1][1];

    await bridge.sessions[chartID].onData({
      type: 'du',
      data: [chartID, { [studyID]: { st: [{ i: 0, v: [1700000000, 42] }] } }],
    });

    expect(study.periods).toEqual([{ $time: 1700000000, plot_0: 42 }]);
  });
});
