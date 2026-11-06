# Research: the blocked calculators (checked 2026-11-06)

Read-only research. No source file was changed. Tags: **[P]** primary (government text I read), **[S]** secondary (never counts), **[NOT FOUND]**.
FY2026-27 is "tax year 2026-27" under the Income-tax Act, 2025 (the Act). It replaced the 1961 Act on 1 Apr 2026 (s.536(1)).

**How texts were read.** incometaxindia.gov.in, pib.gov.in, dea.gov.in and finmin.nic.in refuse automated fetches (403/404). Gazette PDFs were read from copies on other hosts. The Gazette text is what was read. The host is named each time.

## Verdict table

| # | Item | Verdict | The one missing thing |
|---|---|---|---|
| 1 | Small savings: PPF, SSY, NSC, SCSS, KVP, MIS, TD, savings a/c | **READY TO BUILD** | none (Jan-Mar 2027 not out; due ~30 Dec 2026) |
| 1b | Post Office RD | **STILL BLOCKED** | rule text stating quarterly compounding |
| 1c | VPF / EPF rate | **STILL BLOCKED** | the notified EPF rate (only a CBT recommendation seen); ship as editable example |
| 2 | HRA and rent receipt | **READY TO BUILD** | none |
| 3 | FD ladder (DICGC, TDS) | **READY TO BUILD** | none (do not model the no-PAN rate) |
| 4 | Gold jewellery bill | **READY TO BUILD** | re-check that Schedule IV was untouched by the 30 Apr 2026 amendment |
| 5 | LTCG harvesting | **READY TO BUILD** | none |
| 6 | Exit settlement (E8) | **STILL BLOCKED** | the CBDT leave (Rs 25 lakh) and gratuity (Rs 20 lakh) notifications, unopened |
| 7 | Rules file check | no number wrong | see end |

---

## 1. Small savings rates

- **[P] Oct-Dec 2026 unchanged.** Office Memorandum F.No.1/4/2019-NS, 30.09.2026, Ministry of Finance, DEA (Budget Division): "The rates of interest on various Small Savings Schemes for the third quarter of FY 2026-27 starting from 1st October, 2026 and ending on 31st December, 2026 shall remain unchanged from those notified for the second quarter (1st July, 2026 to 30th September, 2026)". I read the scan (Dept of Posts SB Order 12/2026 plus the OM): https://www.staffnews.in/wp-content/uploads/2026/10/ECE_15533.pdf . It is a staff-news host, not dea.gov.in. The OM has no table.
- **[P] The numbers**, from National Savings Institute (NSI) rate pages, `https://www.nsiindia.gov.in/InternalPage.aspx?Id_Pk=N`. Each last row ends "30.09.2026" (page not refreshed for October; the OM carries it forward). The same figures match a bank's table **[S]**.

| Scheme | Rate | Id_Pk |
|---|---|---|
| PPF | 7.1% (since 01.04.2020) | 178 |
| SSY | 8.2% (since 01.01.2024) | 179 |
| SCSS | 8.20% (since 1.04.2023) | 181 |
| NSC | 7.70% (since 01-04-2023) | 182 |
| KVP | 7.5%, matures in 115 months | 180 |
| MIS | 7.4% | 183 |
| RD | 6.7% (since 01.10.2023) | 184 |
| Time deposit 1/2/3/5 yr | 6.90 / 7.00 / 7.10 / 7.50% | 185 |
| Savings a/c | 4.0% (since 01-12-2011) | 187 |

- **[NOT FOUND] Jan-Mar 2027.** Not announced. Show "valid to 31 Dec 2026".
- **Never copy a rate from a scheme rule text.** They carry 2020 rates (SCSS 7.4%, MIS 6.6%, TD 5.5/6.7%, NSC maturity table 6.8%).

**Scheme rules [P]** (nsiindia.gov.in, `Id_Pk` of the rule text, then the scheme page):

- **PPF** (169, 55): Rs 500 to Rs 1,50,000 a year, multiples of Rs 50. Interest on "lowest balance ... between the close of the fifth day and the end of the month". "Interest shall be credited to the account at the end of each year."
- **SSY** (171, 89): Rs 250 to Rs 1.5 lakh a year. Open until the girl is 10. Deposits 15 years, matures at 21. Interest on the month's lowest balance, "credited ... at the end of each financial year".
- **NSC** (167, 90): 5 years, min Rs 1,000 (then Rs 100 multiples), no maximum. Yearly interest "deemed to have been reinvested" to year 4. Rs 1,000 becomes Rs 1,449.03 at 7.7% (1.077^5, my arithmetic).
- **SCSS** (168, 62): age 60+ (55+ retired, 50+ ex-defence). Rs 1,000 multiples, **max Rs 30 lakh**. Interest paid quarterly (first working day of Apr/Jul/Oct/Jan), unclaimed interest earns nothing. 5 years, extend 3.
- **KVP** (170, 56): min Rs 1,000, no maximum. "Deposit ... shall double on maturity." 7.5% over 115 months = 1.99985x (my arithmetic), so annual compounding fits.
- **MIS** (166, 57): min Rs 1,000. **Max Rs 9 lakh single, Rs 15 lakh joint**. Interest paid monthly. 5 years.
- **TD** (164, 58): "compounded on quarterly basis and payable ... at the end of each year". Opening-date rate holds to maturity. Not withdrawable before 6 months.
- **Savings** (163, 60): 4% on the lowest balance "between the close of the tenth day and the end of the month", credited yearly. Nothing earned if the balance dips under Rs 500.
- **RD** (165, 59): min Rs 100, 5 years. **No compounding wording found.**

**VPF/EPF.** PIB (403 to me; seen via search) says the CBT "recommends 8.25% ... for FY 2025-26", pending Government notification: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2234502&reg=3&lang=1 . A circular dated 1 Jul 2026 is reported **[S]**; its EPFO URL is 404. FY2026-27 rate not yet declared.

**Builder inputs:** the rates, limits and payout rules above. Stamp every result "OM F.No.1/4/2019-NS, 30.09.2026".

**READY TO BUILD** except RD and EPF/VPF.

---

## 2. HRA and rent receipt

- **[P] Section:** Act, **Schedule III (See section 11), Table Sl. 11**, https://egazette.gov.in/WriteReadData/2025/265620.pdf . "Any special allowance from employer ... (a) ... granted to meet expenditure actually incurred on payment of rent ... (b) ... to such extent as may be prescribed having regard to the area or place ... (c) the residential accommodation ... is not owned by him; and (d) the assessee has actually incurred expenditure on payment of rent".
- **[P] Formula: Income-tax Rules, 2026, Rule 279**, G.S.R. 198(E), 20 Mar 2026, in force 1 Apr 2026. Read from https://www.staffnews.in/wp-content/uploads/2026/03/Income-Tax-Rules-2026.pdf (Gazette p.1776). "the least of ... (a) the actual amount of such allowance received ... (b) the amount by which the expenditure actually incurred ... in payment of rent ... exceeds one-tenth of the amount of salary ... (c) ... such percentage of salary".
  - **50%:** "Mumbai, Kolkata, Delhi, Chennai, Hyderabad, Pune, Ahmedabad and Bengaluru". **40%:** "Any other place."
  - **Salary** (Rule 279(2)(b)): "includes dearness allowance, if provided for under the terms of employment, but excludes all other allowances and perquisites". "Relevant period" = months the home was occupied in the tax year.
- **[P] Landlord PAN: Rule 205 (Form No. 124, s.392(5)(b)), Table Sl. 1:** "Name, address and Permanent Account Number of the landlord or landlords, where the aggregate rent paid during the tax year exceeds **Rs 100000**".
- **[P] New regime: no HRA.** s.202(2)(a)(i) computes income "without any exemption or deduction under ... Schedule III (Table: Sl. No.5 or 6 or 7 or 8 or 11 or 17)". Finance Act 2026 does not touch Sl. 11.
- **[P] Corrigendum G.S.R. 286(E), 16 Apr 2026** does not touch Rule 279 (p.1776) or Rule 205 (p.1687).
- **Old to new:** was s.10(13A), Rule 2A, Form 12BB. This mapping is mine, **[NOT FOUND]** in a government table. The old four-city list is from memory.
- **Numbers changed:** the 50% list grew from 4 to 8 cities. 10% and 40% look unchanged.

**Builder:** inputs salary (basic + DA if in the terms), HRA, rent, city, months, regime. Exempt = least of the three, never below 0. New regime exempt = 0. Example: salary 6,00,000, HRA 3,00,000, rent 2,40,000, Bengaluru: (a) 3,00,000, (b) 1,80,000, (c) 3,00,000, so exempt 1,80,000, taxable HRA 1,20,000. Rent receipt shows a landlord-PAN box when yearly rent exceeds Rs 1,00,000. Edge: own home, rent to a parent, part year, mid-year pay change.

**READY TO BUILD.**

---

## 3. FD ladder

- **[P] DICGC cover Rs 5,00,000** per depositor per bank "in the same right and capacity", principal and interest together (Rs 4,95,000 + Rs 4,000 interest is covered; Rs 5,00,000 principal leaves its interest uncovered). https://www.dicgc.org.in/guide-to-deposit-insurance and https://www.dicgc.org.in/FAQs . Individual-capacity accounts at one bank (all branches, all types) share one limit. Joint, partner, guardian, trustee accounts insure separately. Different banks insure separately.
- **No change found.** Press talks of Rs 7.5 lakh **[S]**; no notification found. **[NOT FOUND]** a primary date for when Rs 5 lakh began (4 Feb 2020 is [S]); print no date.
- **[P] TDS on bank interest: Act s.393(1) Table Sl. 5(ii)** ("interest other than interest on securities" paid by a bank, co-operative bank or post office): "Threshold limit: (a) Rs 1,00,000 in the case of a senior citizen; (b) Rs 50,000 in case of person other than senior citizen." Old section was 194A (mapping mine). Finance Act 2026 does not amend Sl. 5(ii).
- **[P] Rate 10%:** Finance Act 2026 (Act 4 of 2026, assent 30 Mar 2026), First Schedule Part II para 1(a)(i). Copy: https://taxo.online/wp-content/uploads/2026/03/FinanceAct2026.pdf
- **[P] Senior citizen** (s.2(100)): 60 or more "at any time during the relevant tax year". **Form 121** is the no-TDS declaration (Rule 211, s.393(6)).
- **[NOT FOUND]** the no-PAN rate (not read).

**Builder:** one rung per bank. Warn when principal + accrued interest at a bank passes Rs 5,00,000. Flag TDS when yearly interest passes Rs 50,000 (Rs 1,00,000 if 60+). Per-bank aggregation across branches is bank practice, so label it an assumption. Edge: joint and minor accounts, co-operative banks.

**READY TO BUILD.**

---

## 4. Gold jewellery bill

- **[P] 3% on jewellery.** Notification 9/2025-Central Tax (Rate), 17 Sep 2025, G.S.R. 641(E), from 22 Sep 2025: "Schedule IV- 1.5%", serial 10, heading **7113** "Articles of jewellery and parts thereof, of precious metal or of metal clad with precious metal". 1.5% + 1.5% = 3%. IGST side not read. Copy: https://www.taxheal.com/wp-content/uploads/2025/09/266209-9-2025-central-tax-rate-17.09.25.pdf
- **[P] Job work 5%.** Notification 15/2025-Central Tax (Rate), G.S.R. 663(E), entry 26 of 11/2017 (heading 9988): job work on "all products, other than diamonds, falling under Chapter 71" at **2.5%** central (5% total). Diamonds 1.5% total. Copy: https://bcasonline.org/wp-content/uploads/2025/09/No.15-2025-Central-Tax-Rate.pdf
- **[P] The answer for a shopper.** CBEC Gems & Jewellery FAQ (GST Council host), Q7 (Rs 28,000 gold + Rs 2,000 making): "GST is payable at the rate of 3% of the total transaction value of jewellery, whether the making charge is shown separately or not." Q8: the 5% is on the job worker's "job charges only". https://www.gstcouncil.gov.in/sites/default/files/2024-02/sectoral-fq-gems-jewellery.pdf
- **[P] Basis:** CGST Act s.15(2)(c) puts "any amount charged for anything done by the supplier in respect of the supply" in the value. https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_CGST_act/active/chapter4/section15_v1.00.html
- **Verdict.** The sources do not truly conflict. "3% + 5%" is two cases. Retail sale of a ready piece: **3% on the whole bill**. Own gold brought for making: **5% on the job charge**. A shop billing 5% on making for a ready piece is over-charging on this FAQ. Blogs say otherwise **[S]**.
- **Caveats.** The FAQ is guidance, not a notification. Notification 01/2026-Central Tax (Rate), 30 Apr 2026, realigned tariff entries; **[S]** summaries say Schedules I and III only. I did not read it. Re-check Schedule IV serial 10 once.

**Builder:** inputs weight, purity, rate, making (flat or %), stones. GST = 3% x (metal + making + stones), CGST 1.5% + SGST 1.5%. Add a line "if billed 5% on making, extra = 2% of making". Edge: old-gold exchange (net or gross is not settled here), inter-state 3% IGST, lab-grown stones.

**READY TO BUILD** with the one re-check.

---

## 5. LTCG harvesting (all [P], Act text, same Gazette PDF)

| Rule | New Act | Wording |
|---|---|---|
| Equity LTCG, first Rs 1,25,000 free, then 12.5% | **s.198(2)(a)** | "exceeding ₹ 125000 at the rate of 12.5%" |
| Other LTCG | s.197(1)(b) | "12.5%" |
| Equity STCG | **s.196(1)(i)** | "at the rate of 20%" (STT paid) |
| Holding | **s.2(101)** | listed securities and equity-fund units: "twelve months", so long-term is **more than 12 months** |
| Grandfathering | **s.90(7)-(8)** | bought before 1 Feb 2018: cost = higher of cost and the lower of (31 Jan 2018 price, sale price) |
| Low-income adjustment | s.198(3) | resident individual or HUF: gain reduced by the shortfall of other income below the basic limit |
| Surcharge | Finance Act 2026, Part I-B Para F | "shall not exceed 15%" on s.196-198 gains |

- s.198(1)(c): STT must be paid. Finance Act 2026 does not amend ss.196-198 or s.90. Old sections (111A, 112A, 55(2)(ac)) are my mapping, not a government table.
- Unchanged: Rs 1.25 lakh, 12.5%, 20%, 12 months. Grandfathering still applies.

**Builder:** inputs holdings (buy date, cost, price), LTCG already booked, other income. Show headroom to Rs 1,25,000, the gain to book, tax saved at 12.5% plus 4% cess. Grandfathered cost needs the 31 Jan 2018 price as input. Edge: the Rs 1.25 lakh is per person per year across all stocks and equity funds; losses set off first; I read no anti-wash-sale rule.

**READY TO BUILD.**

---

## 6. Exit settlement (E8)

- **[P] Labour Codes in force from 21 Nov 2025.** Ministry FAQs on labour.gov.in ("As on 16.03.2026"): "The definition of 'wages' has come into effect from 21.11.2025"; "Gratuity calculation will be applicable w.e.f. 21.11.2025". https://www.labour.gov.in/static/uploads/2026/01/de4758d5bfeffc456d7de97a801891b0.pdf , https://www.labour.gov.in/static/uploads/2026/03/a4ccf4c6d97c4f1f36a6d83f8c64213d.pdf . PIB release gave 403. Commencement S.O. numbers (5322(E), 5319(E)) are **[S]**.
- **[P] Wages Rules:** G.S.R. 343(E), 8 May 2026 (https://www.labour.gov.in/static/uploads/2026/05/6eb0c35ba63b776487a025e5123b6b12.pdf); short title fixed by G.S.R. 629(E), 15 Jul 2026 **[S]**. Social Security (Central) Rules 2026 reported notified 8 May 2026 **[S]**; gazette text **[NOT FOUND]**.
- **[P] "Wages"** = basic + DA + retaining allowance; allowances above 50% of total pay are added back. FAQ example: pay 76,000, basic+DA 20,000, allowances 40,000, gratuity etc. 16,000, so add back 2,000, wages 22,000.
- **[P] Gratuity, Code s.53** (https://egazette.gov.in/WriteReadData/2020/222111.pdf): 5 years (1 for fixed-term); "For every completed year of service or part thereof in excess of six months ... fifteen days' wages ... based on the rate of wages last drawn"; "(3) ... shall not exceed such amount as may be notified". **No 26-day divisor in the Code text.** FAQ: the maximum "is as notified by the Central Government which is currently ₹ 20 lakhs". **[NOT FOUND]** the s.53(3) notification.
- **[P] Gratuity tax, Act s.19(1) Table Sl. 5** (names the repealed 1972 Act, "section 4(2) and (3)") **and Sl. 6** (least of actual, notified amount, half a month's salary per completed year on the 10-month average). Salary = basic + DA if the terms say so (s.19(2)(b)). Which entry a Code-covered employee uses is unsettled in the text.
- **[P] Leave encashment tax, Act s.19(1) Table Sl. 14** (non-government, at retirement "whether on superannuation or otherwise", so resignation counts): least of (a) leave at credit (entitlement at most 30 days per year of service), (b) 10 x average monthly salary of the last 10 months, (c) "amount as the Central Government may, by notification, specify", (d) actual payment. Aggregate across employers cannot pass the notified limit less earlier exemptions (s.19(2)(f)). Leave cashed during service: no exemption.
- **Notified limits [S] only:** leave Rs 25 lakh (CBDT Notification 31/2023, 24 May 2023); gratuity Rs 20 lakh (CBDT, 8 Mar 2019). I could not open either. s.536(2)(j) keeps old notifications alive "so far as it is not inconsistent" **[P]**, but none is re-issued under the 2025 Act.
- **Both are allowed in the new regime:** s.202(2)(a) removes only s.19(1) Sl. 1 and Schedule III Sl. 5-8, 11, 17.
- **Notice pay recovery: [NOT FOUND].** No statutory formula; it is contract. **[P]** handbook (https://www.labour.gov.in/static/uploads/2026/02/83978455025732b99b0165def80ab171.pdf): dues within **two working days** of leaving (s.17); deductions "shall not exceed 50% of wages during the wage period" (s.18). Whether notice recovery is an allowed deduction is not stated. Keep it a user input.
- **[P] EPF wage ceiling (new):** S.O. 5109(E), 17 Sep 2026: "rupees twenty-five thousand (₹25,000) per month ... for the purposes of Chapter III" of the Code on Social Security, replacing S.O. 2702(E), 29 May 2026 (Rs 15,000). https://www.labour.gov.in/static/uploads/2026/09/2b0f1dbbd3769fc388416186ec145328.pdf

**Shows:** revised wages with add-back, gratuity (15 x wages / divisor x years, capped), leave encashment, exempt vs taxable by the s.19 limits, notice recovery (input), gross, estimated TDS, net. The divisor stays an editable default.

**STILL BLOCKED on:** (1) the two CBDT notifications opened as primary (the owner can download them from incometaxindia.gov.in and place them in `docs/`), (2) the Social Security Rules gratuity text, (3) the s.53(3) ceiling notification.

---

## 7. Numbers already in the rules file

Checked against Act s.19, 156, 196-198, 202, and Finance Act 2026. **All match:** new slabs (nil to 4L, then 5/10/15/20/25/30% at each Rs 4 lakh; s.202(1)); old slabs (FA 2026 Part I-B Para A); standard deduction Rs 75,000 / 50,000 (s.19(1) Sl. 2); rebate Rs 60,000 to Rs 12 lakh with marginal relief (s.156(2)) and Rs 12,500 to Rs 5 lakh (s.156(1)); surcharge 10/15/25/37% with 15% cap on gains (FA 2026 Para F); cess 4% (FA 2026 s.3(15)); CG rates and periods (section 5). The new-regime 25% surcharge cap was not re-read.

---

## Discrepancies with our current rules file (`src/engine/tax/rules.FY2026-27.ts`)

No number is wrong. These are gaps and stale comments.

1. **HRA comment is stale.** Now confirmed: Rule 279, G.S.R. 198(E), eight cities, 50% / 40%, salary = DA only if the terms provide it. Add an `hra` block citing Rule 279, Schedule III Sl. 11, Rule 205.
2. **"Finance Act 2026 NOT CHECKED" can close.** Read in full for slabs, surcharge, cess, TDS. It amends s.202(2)(a) (drops SEZ s.144), s.393 and Schedule III (adds 38A), but not ss.19, 90, 156, 196-198 or Sl. 11.
3. **EPF wage ceiling** is now primary: Rs 25,000 from 17 Sep 2026 (S.O. 5109(E)).
4. **Gratuity divisor 26** rests on the repealed 1972 Act s.4(2). Code s.53(2) has no divisor. Mark 26 "assumed".
5. **Gratuity Rs 20 lakh and leave Rs 25 lakh** stay [S] until the notifications are opened. Leave Rs 25 lakh is not in the file.
6. **Gratuity Sl. 5 vs Sl. 6:** Sl. 5 still names the repealed 1972 Act. The engine should say which it follows.
7. **Labour Codes line** can cite the Ministry FAQ ("currently ₹ 20 lakhs"), a [P] FAQ but not the s.53(3) notification.
8. **`RATES_AS_OF`** says 2026-11-02. The tax numbers in section 7 re-checked on 2026-11-06. Small-savings `until` 1 Jan 2027 fits the ~30 Dec 2026 announcement.
