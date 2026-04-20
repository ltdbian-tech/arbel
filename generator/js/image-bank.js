/** ArbelImageBank — curated Unsplash photo IDs grouped by topic keyword.
 *
 *  Image URLs are constructed via the stable Unsplash image CDN pattern:
 *      https://images.unsplash.com/photo-<id>?w=800&q=75&auto=format&fit=crop
 *  which does not require an API key and can be used directly in <img src>.
 *
 *  Use ArbelImageBank.pick('topic', seed?) to get a single URL, or
 *  ArbelImageBank.pickMany('topic', n, seed?) for a non-repeating batch.
 *
 *  Topics map to site-types content slots (productGrid, lookbookHorizontal,
 *  releaseGrid, hero dish photos, etc). When a topic isn't found we fall
 *  back to 'abstract'.
 */
(function (global) {
    'use strict';

    // Photo IDs are the `photo-XXXXXXXXXX-YYYYYYYYYYYY` portion of
    // images.unsplash.com URLs. Each topic should have 4-8 IDs so the
    // picker can rotate and avoid repeats between regens.
    var BANK = {
        // ─── Shop / grocery / produce ───────────────────────────
        'produce':       ['1542838132-92c53300491e','1610832958506-aa56368176cf','1567306226416-28f0efdc88ce','1511690656952-34342bb7c2f2','1571771894821-ce9b6c11b08e','1488459716781-31db52582fe9'],
        'bakery':        ['1568254183919-78a4f43a2877','1549931319-a545dcf3bc73','1608198093002-ad4e005484ec','1558642452-9d2a7deb7f62','1555507036-ab1f4038808a','1586444248902-2f64eddc13df'],
        'dairy':         ['1550583724-b2692b85b150','1563636619-e9143da7973b','1628088062854-d1870b4553da','1488477181946-6428a0291777','1559598467-8e2e7e3b7d3e','1587049352846-4a222e784d38'],
        'butcher':       ['1603048675363-acd8c5bbb41f','1504674900247-0877df9cc836','1558030006-450675393462','1546964124-0cce460f38ef','1529692236671-f1f6cf9683ba','1558030067-b019f4f13e5a'],
        'drinks':        ['1544145945-f90425340c7e','1551538827-9c037cb4f32a','1600271886742-f049b9a3b6c0','1551751299-1b51cab2694c','1570696516188-ade861b84a49','1513558161293-cdaf765ed2fd'],
        // ─── Restaurant / food ──────────────────────────────────
        'restaurant-dish': ['1504674900247-0877df9cc836','1555939594-58d7cb561ad1','1414235077428-338989a2e8c0','1484723091739-30a097e8f929','1546069901-ba9599a7e63c','1540189549336-e6e99c3679fe','1565299624946-b28f40a0ae38'],
        'pasta':         ['1551183053-bf91a1d81141','1621996346565-e3dbc646d9a9','1608897013039-887f21d8c804','1598866594230-a7c12756260f','1587740908075-9e245311b2e3'],
        'ramen':         ['1569718212165-3a8278d5f624','1617093727343-374698b1b08d','1591814468924-caf88d1232e1','1557872943-16a5ac26437e','1623341214825-9f4f963727da'],
        'sushi':         ['1579871494447-9811cf80d66c','1617196034796-73dfa7b1fd56','1553621042-f6e147245754','1563612116625-3012372fccce','1611143669185-af224c5e3252'],
        'burger':        ['1568901346375-23c9450c58cd','1550547660-d9450f859349','1586190848861-99aa4a171e90','1571091718767-18b5b1457add','1551782450-a2132b4ba21d'],
        'coffee':        ['1495474472287-4d71bcdd2085','1509042239860-f550ce710b93','1494314671902-399b18174975','1521302080334-4bebac2763a6','1559496417-e7f25cb6cf30'],
        'dessert':       ['1551024601-bec78aea704b','1488477304112-4944851de03d','1528207776546-365bb710ee93','1547835768-f06d8e11dbb1','1464349095431-e9a21285b5f3'],
        // ─── Fashion / apparel / lookbook ───────────────────────
        'fashion-model':   ['1492707892479-7bc8d5a4ee93','1529139574466-a303027c1d8b','1517841905240-472988babdf9','1488716820095-cbe80883c496','1494790108377-be9c29b29330','1534528741775-53994a69daeb','1507003211169-0a1dd7228f2d'],
        'streetwear':    ['1483985988355-763728e1935b','1517263904808-5dc91e3e7044','1601924572091-3eadc7b7735e','1509631179647-0177331693ae','1560243563-062bfc001d68','1506629082955-511b1aa562c8'],
        'boutique':      ['1558769132-cb1aea458c5e','1490481651871-ab68de25d43d','1469334031218-e382a71b716b','1529139574466-a303027c1d8b','1515886657613-9f3515b0c78f'],
        'couture':       ['1469334031218-e382a71b716b','1515886657613-9f3515b0c78f','1529139574466-a303027c1d8b','1517841905240-472988babdf9','1488716820095-cbe80883c496'],
        'vintage-fashion':['1490481651871-ab68de25d43d','1469334031218-e382a71b716b','1515886657613-9f3515b0c78f','1506629082955-511b1aa562c8','1509631179647-0177331693ae'],
        // ─── Music / album art / performers ─────────────────────
        'album-art':     ['1511671782779-c97d3d27a1d4','1493225457124-a3eb161ffa5f','1514525253161-7a46d19cd819','1470225620780-dba8ba36b745','1445375011782-2384686778a0','1516280440614-37939bbacd81'],
        'performer':     ['1501286353178-1ec881214838','1518609878373-06d740f60d8b','1526478806334-5fd488fcaabc','1506157786151-b8491531f063','1493225457124-a3eb161ffa5f'],
        'electronic':    ['1470225620780-dba8ba36b745','1514525253161-7a46d19cd819','1493225457124-a3eb161ffa5f','1445375011782-2384686778a0','1516280440614-37939bbacd81'],
        // ─── Gaming / esports ──────────────────────────────────
        'gaming':        ['1542751371-adc38448a05e','1511512578047-dfb367046420','1538481199705-c710c4e965fc','1493711662062-fa541adb3fc8','1550751827-4bd374c3f58b','1566577739112-5180d4bf9390'],
        'esports':       ['1511512578047-dfb367046420','1542751371-adc38448a05e','1493711662062-fa541adb3fc8','1593305841991-05c297ba4575'],
        // ─── Portfolio / creative work ─────────────────────────
        'design-work':   ['1561070791-2526d30994b8','1558655146-d09347e92766','1542744173-8e7e53415bb0','1586776977607-310e9c725c37','1508921912186-1d1a45ebb3c1'],
        'architecture':  ['1487958449943-2429e8be8625','1497366216548-37526070297c','1503387762-592deb58ef4e','1545324418-cc1a3fa10c00','1478059299873-f047d8c5fe1a'],
        // ─── Photography ───────────────────────────────────────
        'landscape':     ['1506905925346-21bda4d32df4','1470071459604-3b5ec3a7fe05','1511884642898-4c92249e20b6','1501785888041-af3ef285b470','1476514525535-07fb3b4ae5f1'],
        'portrait':      ['1494790108377-be9c29b29330','1488716820095-cbe80883c496','1534528741775-53994a69daeb','1507003211169-0a1dd7228f2d','1500648767791-00dcc994a43e'],
        'travel':        ['1507525428034-b723cf961d3e','1504893524553-b855bce32c67','1519160558534-579f5106e43f','1523920290228-4f321a939b4c','1476514525535-07fb3b4ae5f1'],
        // ─── Events / conferences ──────────────────────────────
        'conference':    ['1540575467063-178a50c2df87','1475721027785-f74eccf877e2','1505373877841-8d25f7d46678','1515187029135-18ee286d815b','1587825140708-dfaf72ae4b04'],
        'festival':      ['1459749411175-04bf5292ceea','1506157786151-b8491531f063','1501386761578-eac5c94b800a','1470229722913-7c0e2dbbafd3','1471703324024-1ce44cc21f08'],
        // ─── Abstract / fallback ───────────────────────────────
        'abstract':      ['1557672172-298e090bd0f1','1541701494587-cb58502866ab','1550684848-fac1c5b4e853','1557682250-33bd709cbe85','1579546929518-9e396f3cc809','1557682224-5b8590cd9ec5'],
        'texture':       ['1557682250-33bd709cbe85','1557682224-5b8590cd9ec5','1557672172-298e090bd0f1','1515186813873-7abca38478b1','1550684848-fac1c5b4e853']
    };

    // Aliases — map site-types topic hints to bank keys
    var ALIASES = {
        'product':       'produce',
        'grocery':       'produce',
        'food':          'restaurant-dish',
        'dish':          'restaurant-dish',
        'menu':          'restaurant-dish',
        'look':          'fashion-model',
        'lookbook':      'fashion-model',
        'outfit':        'fashion-model',
        'release':       'album-art',
        'album':         'album-art',
        'track':         'album-art',
        'ep':            'album-art',
        'event':         'conference',
        'conf':          'conference',
        'gig':           'festival',
        'tour':          'performer',
        // Sub-style aliases — let AI topic hints like "luxury-mall" or
        // "dtc-minimal" still resolve to a real bank key.
        'luxury':        'couture',
        'luxury-mall':   'boutique',
        'high-fashion':  'couture',
        'vintage':       'vintage-fashion',
        'y2k':           'streetwear',
        'zine':          'streetwear',
        'dtc':           'boutique',
        'dtc-minimal':   'boutique',
        'minimal':       'boutique',
        'drop':          'streetwear',
        'capsule':       'boutique',
        'atelier':       'couture',
        'diner':         'burger',
        'bistro':        'restaurant-dish',
        'fine-dining':   'restaurant-dish',
        'trattoria':     'pasta',
        'noodle':        'ramen',
        'izakaya':       'sushi',
        'cafe':          'coffee',
        'espresso':      'coffee',
        'bar':           'drinks',
        'cocktail':      'drinks',
        'retro-8bit':    'gaming',
        'cyberpunk':     'gaming',
        'horror':        'gaming',
        'moba':          'esports',
        'fps':           'esports',
        'vinyl':         'album-art',
        'synth':         'electronic',
        'techno':        'electronic',
        'house':         'electronic',
        'indie':         'performer',
        'rock':          'performer',
        'hiphop':        'performer',
        'rap':           'performer',
        'editorial':     'fashion-model',
        'runway':        'couture',
        'default':       'abstract'
    };

    function _resolveTopic(topic) {
        if (!topic) return 'abstract';
        var k = String(topic).toLowerCase().trim();
        if (BANK[k]) return k;
        if (ALIASES[k]) return ALIASES[k];
        // fuzzy: try prefix match on bank keys
        for (var key in BANK) {
            if (BANK.hasOwnProperty(key) && (key.indexOf(k) === 0 || k.indexOf(key) === 0)) return key;
        }
        return 'abstract';
    }

    function _urlFor(id, w) {
        if (typeof id !== 'string' || !id) return '';
        var width = w || 800;
        return 'https://images.unsplash.com/photo-' + id + '?w=' + width + '&q=75&auto=format&fit=crop';
    }

    /** Pick one image URL for a topic. Seed stabilises selection so the
     *  same (topic, seed) pair always returns the same image. */
    function pick(topic, seed, width) {
        var key = _resolveTopic(topic);
        var list = BANK[key] || BANK.abstract;
        var idx = (typeof seed === 'number' && isFinite(seed))
            ? Math.abs(seed) % list.length
            : Math.floor(Math.random() * list.length);
        return _urlFor(list[idx], width);
    }

    /** Pick N distinct image URLs for a topic (wraps around if N > bank size). */
    function pickMany(topic, n, seed, width) {
        var key = _resolveTopic(topic);
        var list = BANK[key] || BANK.abstract;
        var out = [];
        var start = (typeof seed === 'number' && isFinite(seed))
            ? Math.abs(seed) % list.length
            : Math.floor(Math.random() * list.length);
        for (var i = 0; i < n; i++) {
            out.push(_urlFor(list[(start + i) % list.length], width));
        }
        return out;
    }

    /** Return all topic keys (for debugging / editor UI). */
    function topics() { return Object.keys(BANK); }

    global.ArbelImageBank = {
        pick: pick,
        pickMany: pickMany,
        topics: topics,
        resolve: _resolveTopic
    };
})(typeof window !== 'undefined' ? window : this);
