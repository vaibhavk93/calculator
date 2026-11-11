import { describe, expect, it } from 'vitest'
import { buildCandidates, parseSms, type ParsedSms, type SkipReason } from './smsParse'
import { starterBudget } from './budget'

/**
 * A wide table of bank-message shapes for the reader (`parseSms`).
 *
 * HONESTY NOTE: every message below is SYNTHETIC. They are written from memory of how Indian banks word their alerts,
 * with made-up amounts, card digits, names and reference numbers. They are NOT copies of real messages and the exact
 * wording of a real bank's text may differ (banks change formats without notice). The table proves the reader's RULES
 * (what it offers, what it refuses), not that any bank still sends exactly this text. Real formats are tracked in
 * `smsParse.test.ts` ("formats seen in a real inbox") and in the on-phone Reader log (`docs/SMS-CAPTURE.md`).
 * No real person, number or account appears here; helpline numbers are the banks' public ones or made up.
 *
 * What is asserted: only money going OUT is offered; amount, mode, last digits, payee and card-bill kind when stated;
 * and anything ambiguous (direction, amount, not-yet-done, failed, one-time code, promotion) is NOT offered.
 */

type Want = { amount: string; last4?: string | null; merchant?: string | RegExp; mode?: ParsedSms['mode']; kind?: ParsedSms['kind']; bank?: string; source?: ParsedSms['source'] }
type Row = [label: string, sender: string, body: string, want: Want | SkipReason | 'skip']

// ------------------------------------------------------------------------------------------------ money OUT
const OUT: Row[] = [
  // ---- HDFC
  ['HDFC UPI to a VPA', 'VM-HDFCBK', 'Rs.2,500.00 debited from HDFC Bank A/c XX1234 on 05-11-26 to VPA bigbasket@hdfcbank (UPI Ref No 100000000001). Not you? Call 18002586161', { amount: '2500.00', last4: '1234', merchant: 'Bigbasket', mode: 'upi', kind: 'spend', bank: 'HDFC Bank' }],
  ['HDFC card, no x marks, mode not stated', 'VM-HDFCBK', 'Spent Rs.799 On HDFC Bank Card 5678 At NETFLIX On 2026-11-05:10:11:12.Not You? To Block+Reissue Call 18002586161', { amount: '799', last4: '5678', merchant: 'Netflix', mode: null, bank: 'HDFC Bank' }],
  ['HDFC credit card, merchant starts with a digit (7-Eleven)', 'VM-HDFCBK', 'Spent Rs.1,499.00 On HDFC Bank CREDIT Card xx4321 At 7-ELEVEN On 2026-11-05:10:11:12. Avl Lim Rs.90,000.00', { amount: '1499.00', last4: '4321', merchant: '7-Eleven', mode: 'credit' }],
  ['HDFC credit card, merchant starts with a digit (1MG)', 'VM-HDFCBK', 'Spent Rs.350 On HDFC Bank CREDIT Card xx4321 At 1MG TECHNOLOGIES On 2026-11-05:09:00:00', { amount: '350', last4: '4321', merchant: /^1mg technologies$/i }],
  ['HDFC debit-card ATM withdrawal', 'VM-HDFCBK', 'Rs.10,000.00 withdrawn from HDFC Bank ATM XX1234 on 05-11-26. Avl Bal Rs.50,000.00', { amount: '10000.00', last4: '1234', mode: 'debit' }],
  ['HDFC NEFT out', 'VM-HDFCBK', 'Rs.15,000.00 debited from a/c XX1234 on 05-11-26 via NEFT to TEST PERSON. Ref N123456789012', { amount: '15000.00', last4: '1234', merchant: 'Test Person', mode: 'netbanking' }],
  ['HDFC IMPS out', 'VM-HDFCBK', 'Rs 5,000.00 sent via IMPS from HDFC Bank A/c XX1234 to TEST PERSON on 05-11-26. Ref 531234567890', { amount: '5000.00', last4: '1234', merchant: 'Test Person', mode: 'netbanking' }],
  ['HDFC EMI debit (two accounts named: the paying one wins)', 'VM-HDFCBK', 'Rs.8,500.00 debited from a/c XX1234 on 05-11-26 towards EMI for loan a/c 99887766', { amount: '8500.00', last4: '1234' }],
  ['HDFC standing instruction executed', 'VM-HDFCBK', 'Your SI of Rs 649.00 for SPOTIFY has been debited from a/c XX1234 on 05-11-26. Ref 100000000002', { amount: '649.00', last4: '1234' }],
  ['HDFC credit-card bill paid from the account', 'VM-HDFCBK', 'Rs.20,000.00 debited from a/c XX1234 on 05-11-26 towards HDFC Credit Card XX9876 bill payment via BillDesk', { amount: '20000.00', last4: '1234', kind: 'cardBill' }],
  ['HDFC "Sent" to a merchant with dots in the name', 'VM-HDFCBK', 'Sent Rs.450.00 From HDFC Bank A/C *1234 To BOOKMYSHOW.COM On 05/11/26 Ref 100000000003 Not You? Call 18002586161', { amount: '450.00', last4: '1234', merchant: 'Bookmyshow.Com' }],
  ['HDFC "Sent" to a merchant with digits in the name', 'VM-HDFCBK', 'Sent Rs.120.00 From HDFC Bank A/C *1234 To SHOP24X7 On 05/11/26 Ref 100000000004 Not You? Call 18002586161', { amount: '120.00', last4: '1234', merchant: 'Shop24x7' }],
  ['UPI to a phone-number VPA never puts the number in the payee', 'VM-HDFCBK', 'Rs.75.00 debited from a/c XX1234 to VPA 9876543210@ybl (TEST PERSON) on 05-11-26. UPI Ref 312345678921', { amount: '75.00', last4: '1234', merchant: '', mode: 'upi' }],
  ['UPI QR merchant id with a long digit tail', 'VM-HDFCBK', 'Rs.250.00 debited from a/c XX1234 to VPA paytmqr281005050101@paytm UPI Ref 312345678922', { amount: '250.00', merchant: 'Paytmqr', mode: 'upi' }],
  ['UPI VPA with a dot and digits', 'VM-HDFCBK', 'Rs.99.00 debited from a/c XX1234 to VPA bharatpe.9012345678@yesbankltd UPI Ref 312345678923', { amount: '99.00', merchant: 'Bharatpe' }],
  ['multi-line text', 'VM-HDFCBK', 'Rs.640.00 debited\nfrom a/c XX1234\non 05-11-26\nto VPA swiggy@ybl\nUPI Ref 312345678924', { amount: '640.00', last4: '1234', merchant: 'Swiggy', mode: 'upi' }],
  ['all capitals', 'VM-HDFCBK', 'RS. 500.00 DEBITED FROM A/C XX1234 ON 05-11-26 TO VPA SHOP@YBL', { amount: '500.00', last4: '1234', mode: 'upi' }],
  ['rupee sign', 'VM-HDFCBK', '₹300 debited from a/c XX1234 to VPA shop@ybl', { amount: '300', mode: 'upi' }],
  ['one decimal place is padded', 'VM-HDFCBK', 'Rs.1,250.5 debited from a/c XX1234 to VPA shop@ybl', { amount: '1250.50' }],
  ['Indian digit grouping', 'VM-HDFCBK', 'Rs.12,34,567.89 debited from a/c XX1234 to VPA shop@ybl', { amount: '1234567.89' }],

  // ---- ICICI
  ['ICICI UPI, payee between semicolons', 'AX-ICICIB', 'ICICI Bank Acct XX678 debited Rs. 450.00 on 05-Nov-26; SHARMA STORES credited. UPI:312345678903. Call 18002662 for dispute. SMS BLOCK 678 to 9215676766.', { amount: '450.00', last4: '678', merchant: 'Sharma Stores', mode: 'upi', bank: 'ICICI Bank' }],
  ['ICICI card, payee after "at"', 'VM-ICICIB', 'Rs 3,200.00 spent on ICICI Bank Card XX4321 on 05-Nov-26 at MYNTRA DESIGNS. Avl Limit: Rs 1,20,000.00. If not you, call 18002662', { amount: '3200.00', last4: '4321', merchant: 'Myntra Designs' }],
  ['ICICI card, payee after the date and "on"', 'VM-ICICIB', 'INR 799.00 spent using ICICI Bank Card XX4321 on 05-Nov-26 on AMAZON. Avl Limit: INR 90,000.00. If not you, call 18002662', { amount: '799.00', last4: '4321', merchant: 'Amazon' }],
  ['ICICI debit-card ATM', 'VM-ICICIB', 'Dear Customer, Rs 5,000.00 withdrawn using ICICI Bank Debit Card XX4321 at ATM on 05-Nov-26. Avl Bal Rs 10,000.00', { amount: '5000.00', last4: '4321', mode: 'debit' }],

  ['ICICI "sent via UPI from <bank> A/c ... to NAME handle": the NAME is the payee (phone-test regression)', 'VM-ICICIB', 'Rs 150.00 sent via UPI from ICICI Bank A/c *9087 to RAHUL SHARMA rahul.s@okaxis on 05-11-26. UPI Ref 631245987012. Not you? Call 18002662', { amount: '150.00', last4: '9087', merchant: 'Rahul Sharma', mode: 'upi', bank: 'ICICI Bank' }],
  ['"paid to NAME" with no handle', 'VM-HDFCBK', 'Paid Rs.250 to Chai Point from HDFC Bank A/c XX1234. UPI Ref 312345678922', { amount: '250', last4: '1234', merchant: 'Chai Point', mode: 'upi' }],
  ['UPI/P2A/ref/NAME (payment to an account)', 'VM-AXISBK', 'INR 90.00 debited A/c no. XX1234 05-11-26 22:30:45 UPI/P2A/312345678900/ASHA DEVI. SMS BLOCK UPI to 18001035577', { amount: '90.00', last4: '1234', merchant: 'Asha Devi', mode: 'upi' }],
  ['trf to NAME Refno', 'AD-SBIUPI', 'Dear UPI user A/C X1234 debited by 250.0 on date 02Nov26 trf to PRIYA NAIR Refno 312345678904. If not u? call 1800111109', { amount: '250.00', last4: '1234', merchant: 'Priya Nair', bank: 'State Bank of India' }],

  // ---- SBI
  ['SBI account debit, transfer to a person', 'AD-SBIUPI', 'Dear SBI User, your A/c X1234 is debited by Rs.2000.00 on 05Nov26 transfer to TEST PERSON (Ref No 312345678908). If not done by you, fwd this SMS to 9223008333 & call 1800111109 -SBI', { amount: '2000.00', last4: '1234', merchant: 'Test Person', bank: 'State Bank of India' }],
  ['SBI credit card spend with a link at the end', 'VM-SBICRD', 'Rs.1299.00 spent on your SBI Credit Card ending with 4321 at AMAZON on 05/11/26. Trxn. not done by you? Report at https://sbicard.example/dispute', { amount: '1299.00', last4: '4321', merchant: 'Amazon', mode: 'credit', bank: 'State Bank of India' }],
  ['SBI ATM', 'AX-CBSSBI-S', 'Rs 5000 withdrawn at SBI ATM S1NW000123 from A/c X1234 on 05Nov26. Avl Bal Rs 10000.00', { amount: '5000', last4: '1234', mode: 'debit' }],

  // ---- Axis
  ['Axis "Debit INR" UPI line (word Debit, not Debited)', 'AX-AXISBK', 'Debit INR 1,234.00 A/c no. XX1234 05-11-26 22:30:45 UPI/P2M/312345678910/AMAZON PAY SMS BLOCK UPI to 18001035577', { amount: '1234.00', last4: '1234', merchant: 'Amazon Pay', mode: 'upi', bank: 'Axis Bank' }],
  ['Axis card, payee after IST', 'AX-AXISBK', 'Spent INR 3,500 Axis Bank Card no. XX4828 05-11-26 12:00:00 IST SWIGGY Avl Limit: INR 50,000 Not you? SMS BLOCK 4828 to 5676791', { amount: '3500', last4: '4828', merchant: 'Swiggy' }],
  ['Axis card, payee is a web address', 'AX-AXISBK', 'Spent INR 1,000 Axis Bank Card no. XX4828 05-11-26 12:00:00 IST WWW.IRCTC.CO.IN Avl Limit: INR 50,000', { amount: '1000', last4: '4828', merchant: /irctc/i }],
  ['Axis loan EMI debit', 'AX-AXISBK', 'INR 4,500.00 debited from A/c no. XX1234 on 05-11-26 towards your loan EMI', { amount: '4500.00', last4: '1234' }],

  // ---- Kotak
  ['Kotak UPI "Sent"', 'VM-KOTAKB', 'Sent Rs.250.00 from Kotak Bank AC X1234 to cafecoffeeday@okaxis on 05-11-26.UPI Ref 312345678911. Not you, Call 18002100', { amount: '250.00', last4: '1234', merchant: 'Cafecoffeeday', mode: 'upi', bank: 'Kotak Mahindra Bank' }],
  ['Kotak credit card', 'VM-KOTAKB', 'Rs.1,500.00 spent on Kotak Credit Card XX4321 at BIGBASKET on 05-NOV-26. Avl limit Rs.88,000.00', { amount: '1500.00', last4: '4321', merchant: 'Bigbasket', mode: 'credit' }],
  ['Kotak NACH debit', 'VM-KOTAKB', 'Your Kotak Bank a/c XX1234 has been debited for Rs.999.00 on 05-11-26 for NACH debit - SPOTIFY', { amount: '999.00', last4: '1234' }],

  // ---- IDFC FIRST
  ['IDFC FIRST UPI', 'VK-IDFCFB', 'Dear Customer, Your A/c XX1234 is debited by INR 700.00 on 05-Nov-26. UPI Ref: 312345678912. Paid to ZOMATO. Not you? Call 18108', { amount: '700.00', last4: '1234', merchant: 'Zomato', mode: 'upi', bank: 'IDFC First Bank' }],
  ['IDFC FIRST credit card', 'VK-IDFCFB', 'INR 2,000.00 spent on IDFC FIRST Bank Credit Card XX4321 at UBER INDIA on 05-NOV-26. Avl limit INR 1,00,000.00', { amount: '2000.00', last4: '4321', merchant: 'Uber India', mode: 'credit' }],

  // ---- Yes Bank
  ['Yes Bank UPI', 'VM-YESBNK', 'Rs.600.00 debited from your YES BANK a/c XX1234 on 05/11/2026 via UPI to VPA tea@ybl. Ref 312345678913', { amount: '600.00', last4: '1234', merchant: 'Tea', mode: 'upi', bank: 'Yes Bank' }],
  ['Yes Bank card with "Transaction Alert"', 'VM-YESBNK', 'Transaction Alert: INR 4,500.00 spent on YES BANK Credit Card ending 4321 at FLIPKART on 05-11-26', { amount: '4500.00', last4: '4321', merchant: 'Flipkart', mode: 'credit' }],

  // ---- PNB
  ['PNB UPI with a balance after', 'VM-PNBSMS', 'A/c XX1234 debited INR 1,000.00 on 05-11-2026 by UPI Ref No 312345678914 to TESTSHOP. Bal: Rs 5,000.00 -PNB', { amount: '1000.00', last4: '1234', merchant: 'Testshop', mode: 'upi', bank: 'Punjab National Bank' }],
  ['PNB transfer: our account debited, the other credited', 'VM-PNBSMS', 'Your a/c no. XX1234 is debited for Rs.1000.00 on 05-11-26 and a/c no. XX5678 is credited (IMPS Ref no 531234567890). -PNB', { amount: '1000.00', last4: '1234', mode: 'netbanking' }],

  // ---- Bank of Baroda
  ['BoB: debited from us, credited to another', 'VM-BOBSMS', 'Rs.1500 debited from A/c XXXXXX1234 and credited to TEST PERSON via UPI Ref No 312345678915. -BOB', { amount: '1500', last4: '1234', merchant: 'Test Person', mode: 'upi', bank: 'Bank of Baroda' }],

  // ---- Canara
  ['Canara, sender header does not name the bank (body does)', 'VM-CANBNK', 'An amount of INR 2,000.00 has been DEBITED to your account XXX1234 on 05/11/2026. Total Avail.bal INR 5,000.00 - Canara Bank', { amount: '2000.00', last4: '1234', bank: 'Canara Bank' }],
  ['Canara UPI "paid thru"', 'VM-CANBNK', 'Rs 100.00 paid thru A/C XX1234 on 05-11-26 12:00:00 to TEA STALL, UPI Ref 312345678918. If fraud report to 1930 -Canara Bank', { amount: '100.00', last4: '1234', merchant: 'Tea Stall', mode: 'upi' }],

  // ---- IndusInd
  ['IndusInd UPI', 'VM-INDUSB', 'Rs 1,200.00 debited from your IndusInd Bank a/c XX1234 on 05-Nov-26 UPI Ref 312345678919 to cafe@okicici', { amount: '1200.00', last4: '1234', merchant: 'Cafe', mode: 'upi', bank: 'IndusInd Bank' }],
  ['IndusInd card "Txn of"', 'VM-INDUSB', 'Txn of INR 999.00 done on IndusInd Bank Credit Card XX4321 at SPOTIFY on 05-11-26. Avl Lmt INR 90,000', { amount: '999.00', last4: '4321', merchant: 'Spotify', mode: 'credit' }],

  // ---- Federal
  ['Federal UPI', 'VM-FEDBNK', 'Rs 300.00 debited from your Federal Bank a/c XX1234 on 05-Nov-26 to VPA tea@fbl. Ref no 312345678920.', { amount: '300.00', last4: '1234', merchant: 'Tea', mode: 'upi', bank: 'Federal Bank' }],
  ['Federal debit-card purchase', 'VM-FEDBNK', 'You have made a purchase of Rs 1,000 on Federal Bank Debit Card XX4321 at STORE on 05-11-26', { amount: '1000', last4: '4321', merchant: 'Store', mode: 'debit' }],

  // ---- AU Small Finance
  ['AU UPI', 'VM-AUBANK', 'INR 500.00 debited from your AU Bank a/c XX1234 on 05-11-26 via UPI to cafe@aubank. Ref: 312345678921', { amount: '500.00', last4: '1234', merchant: 'Cafe', mode: 'upi', bank: 'AU Small Finance Bank' }],

  // ---- Paytm Payments Bank
  ['Paytm Payments Bank UPI "Paid"', 'VM-PYTMPB', 'Paid Rs.250 to Chai Point from Paytm Payments Bank A/c XX1234. UPI Ref 312345678922', { amount: '250', last4: '1234', merchant: 'Chai Point', mode: 'upi', bank: 'Paytm Payments Bank' }],
  ['Paytm wallet payment (no card digits)', 'VM-PYTMPB', 'Paid Rs.100 to Chai Point from Paytm Wallet', { amount: '100', last4: null, merchant: 'Chai Point' }],

  // ---- Amex
  ['Amex card, five-digit tail and IST at the end', 'VM-AMEXIN', "Alert: You've spent INR 2,500.00 on your AMEX card ** 41005 at AMAZON on 5 November 2026 at 10:15 PM IST.", { amount: '2500.00', last4: '1005', merchant: 'Amazon', bank: 'American Express' }],

  // ---- foreign currency: only an explicit INR figure is ever the amount
  ['a debit alert that only mentions refunds in general is still a debit', 'VM-HDFCBK', 'Rs 500 debited from a/c XX1234 at AMAZON. Refunds take 7 days', { amount: '500', last4: '1234' }],
  ['a time or date after "at" is never taken as the payee', 'VM-HDFCBK', 'Rs.100.00 debited from a/c XX1234 at 10:15 PM on 05-11-26', { amount: '100.00', last4: '1234', merchant: '' }],
  ['a date after "at" is never taken as the payee', 'VM-HDFCBK', 'Rs.100.00 debited from a/c XX1234 at 5 November 2026 10:15 PM', { amount: '100.00', last4: '1234', merchant: '' }],
  ['USD spend with the rupee amount stated', 'VM-HDFCBK', 'Spent Rs.2,100.50 On HDFC Bank CREDIT Card xx4321 At OPENAI (USD 25.00) On 2026-11-05:10:11:12', { amount: '2100.50', last4: '4321', mode: 'credit' }],
]

// ------------------------------------------------------------------------------------------------ NOT offered
const NOT_OFFERED: Row[] = [
  // ---- money in
  ['HDFC UPI credit', 'VM-HDFCBK', 'Rs.5,000.00 credited to a/c XX1234 on 05-11-26 by VPA test@okhdfc (UPI Ref 312345678906)', 'credit'],
  ['HDFC salary by NEFT', 'VM-HDFCBK', 'Rs.50,000.00 credited to a/c XX1234 on 05-11-26 by NEFT from ACME PVT LTD. Avl Bal Rs.60,000.00', 'credit'],
  ['ICICI "is credited with"', 'AX-ICICIB', 'Dear Customer, Acct XX678 is credited with Rs 12,000.00 on 05-Nov-26 from TEST PERSON. IMPS Ref 531234567890-ICICI Bank', 'credit'],
  ['SBI "credited by"', 'AD-SBIUPI', 'Dear SBI User, your A/c X1234-credited by Rs.500 on 05Nov26 transfer from TEST PERSON Ref No 312345678909', 'credit'],
  ['Kotak "Received ... in your"', 'VM-KOTAKB', 'Received Rs.1,000.00 in your Kotak Bank AC X1234 from test@ybl on 05-11-26.UPI Ref:312345678930.', 'credit'],
  ['IDFC credited', 'VK-IDFCFB', 'Your IDFC FIRST Bank a/c XX1234 is credited with INR 5,000.00 on 05-Nov-26', 'credit'],
  ['BoB credited', 'VM-BOBSMS', 'Rs.2000.00 Credited to your A/c XXXXXX1234 on 05-11-26 through UPI Ref No 312345678917. -BOB', 'credit'],
  ['Canara CREDITED', 'VM-CANBNK', 'An amount of INR 2,000.00 has been CREDITED to your account XXX1234 on 05/11/2026 -Canara Bank', 'credit'],
  ['Paytm Payments Bank received', 'VM-PYTMPB', 'Rs.100 received in your Paytm Payments Bank A/c XX1234 from TEST via UPI', 'credit'],
  ['cash deposit', 'VM-HDFCBK', 'Rs 5,000.00 deposited in your a/c XX1234 by cash on 05-11-26', 'credit'],
  ['interest credited', 'VM-HDFCBK', 'Interest of Rs 120.50 credited to a/c XX1234 for the quarter ending 30-09-26', 'credit'],
  ['dividend credited', 'VM-HDFCBK', 'Dividend of Rs 500 credited to your a/c XX1234 by ACME LTD', 'credit'],
  ['"You have received"', 'VM-HDFCBK', 'You have received Rs 500 from TEST PERSON via UPI on 05-11-26', 'credit'],
  ['credit first, then a charge debited (direction unclear)', 'VM-HDFCBK', 'Rs 1000 credited to a/c XX1234. Rs 5 debited as SMS charges', 'unsure'],
  ['PNB transfer where OUR account is the credited one', 'VM-PNBSMS', 'Your a/c no. XX1234 is credited for Rs.5000.00 on 05-11-26 and a/c no. XX5678 is debited (IMPS Ref no 531234567890)', 'unsure'],

  // ---- refunds, reversals, cashback
  ['refund initiated', 'VM-HDFCBK', 'Refund of Rs 500 initiated to your a/c XX1234 for order 1234', 'credit'],
  ['reversal credited to the card', 'VM-ICICIB', 'Reversal of Rs 1,000 has been credited to ICICI Bank Card XX4321', 'credit'],
  ['"has been reversed"', 'VM-ICICIB', 'Dear Customer, your transaction of INR 799.00 on ICICI Bank Card XX4321 at AMAZON on 05-Nov-26 has been reversed.', 'credit'],
  ['cashback credited', 'VM-HDFCBK', 'Cashback of Rs 50 credited to your HDFC Bank Credit Card XX4321', 'credit'],

  // ---- failed / declined / not yet done
  ['UPI failed', 'VM-HDFCBK', 'Your UPI transaction of Rs 500 to SHOP failed. Amount not debited.', 'not-a-payment'],
  ['card declined', 'VM-HDFCBK', 'Txn of Rs 500 on card XX4321 at SHOP was declined due to insufficient funds', 'not-a-payment'],
  ['unsuccessful, to be refunded', 'VM-HDFCBK', 'Rs 500 debited from a/c XX1234 for UPI to SHOP. Transaction unsuccessful, amount will be refunded', 'not-a-payment'],
  ['debit failed', 'VM-HDFCBK', 'Your a/c XX1234 debit of Rs 500 failed due to insufficient balance', 'not-a-payment'],
  ['could not be completed', 'VM-HDFCBK', 'Your payment of Rs 500 to SHOP could not be completed', 'not-a-payment'],
  ['rejected', 'VM-HDFCBK', 'Your payment of Rs 500 to SHOP from a/c XX1234 was rejected', 'not-a-payment'],
  ['failure', 'VM-HDFCBK', 'Transaction failure: payment of Rs 500 on card XX4321 at SHOP', 'not-a-payment'],
  ['not processed', 'VM-HDFCBK', 'Your payment of Rs 500 on card XX4321 was not processed', 'not-a-payment'],
  ['will not be debited', 'VM-HDFCBK', 'Txn of Rs 500 at SHOP is on hold. Your a/c XX1234 will not be debited until you confirm', 'not-a-payment'],
  ['scheduled debit', 'VM-HDFCBK', 'Rs 10400 will be debited from a/c XX1234 on 05-11-26 towards EMI', 'not-a-payment'],
  ['pre-debit notice for a standing instruction', 'VM-HDFCBK', 'Pre-debit notice: Rs 649 will be debited from a/c XX1234 on 10-11-26 for SPOTIFY (SI)', 'not-a-payment'],
  ['mandate created (first debit is later)', 'VM-HDFCBK', 'UPI Mandate: you have created a mandate of Rs 649 for NETFLIX from a/c XX1234. First debit on 10-11-26', 'not-a-payment'],
  ['collect request', 'VM-HDFCBK', 'Shop has requested money Rs 500 from you. Pay via UPI', 'not-a-payment'],

  // ---- card bill due and payment received (not money out of a spend)
  ['card bill due', 'VM-HDFCBK', 'HDFC Bank Credit Card XX4321: Total Amount Due Rs 15,000.00, Min Due Rs 750.00 due by 25-NOV-26. Pay via NetBanking', 'not-a-payment'],
  ['statement generated', 'VM-ICICIB', 'Your ICICI Bank Credit Card XX4321 statement is generated. Total Amount Due: Rs 15,000.00, Minimum Amount Due: Rs 750.00, due date 25-Nov-26.', 'not-a-payment'],
  ['card payment received', 'VM-ICICIB', 'Payment of Rs 15,000.00 has been received on your ICICI Bank Credit Card XX4321 through Bharat Bill Payment System on 05-NOV-26.', 'credit'],
  ['"Thank you for your payment" from the card issuer (the bank debit text is the money-out one)', 'VM-AXISBK', 'Thank you for the payment of INR 5,000 towards your Axis Bank Credit Card no. XX4828', 'skip'],

  // ---- OTP
  ['OTP for a transaction', 'VM-HDFCBK', '123456 is your OTP for transaction of Rs.500 at AMAZON. Do not share. Valid for 5 minutes', 'otp'],
  ['OTP to pay', 'VM-HDFCBK', 'Use OTP 456789 to pay Rs 500 to SHOP. Do not share it with anyone', 'otp'],
  ['one time password', 'VM-HDFCBK', 'Your one time password is 123456 for transaction of INR 2000 on HDFC Bank card ending 4321', 'otp'],
  ['verification code', 'VM-HDFCBK', 'Verification code 1234 for debit of Rs 500', 'otp'],
  ['OTP text that also says "debited"', 'VM-HDFCBK', 'OTP for txn of Rs 500 at SHOP is 123456. Your a/c XX1234 is debited only after you enter it. Do not share', 'skip'],

  // ---- promotions
  ['pre-approved loan', 'VM-HDFCBK', 'Pre-approved personal loan of Rs 5,00,000. EMI from Rs 4,999/month. Apply now http://x.example', 'not-a-payment'],
  ['instant loan', 'VM-HDFCBK', 'Congratulations! You are pre-approved for Rs 2,00,000 instant loan. Money credited in 2 mins. Click here', 'not-a-payment'],
  ['"we have sent you" an offer on a card', 'VM-HDFCBK', 'Dear Customer, we have sent you a pre-approved offer of Rs 1,00,000 on your HDFC Bank Credit Card. Click here to avail', 'skip'],
  ['cashback offer', 'VM-ICICIB', 'Get 10% cashback up to Rs 500 on spends via ICICI Bank Credit Card. Offer valid till 30-Nov. T&C apply', 'not-a-payment'],
  ['EMI conversion offer', 'VM-AXISBK', 'Convert your transaction of INR 91073 into easy monthly EMIs with tenure up to 49 months with FLEXI EMI on your Axis Bank Credit Card. Convert now. *T&Cs.', 'not-a-payment'],
  ['pre-approved with auto-debited EMI', 'VM-HDFCBK', 'Pre-approved Rs 1,00,000 loan on your credit card. EMI will be auto-debited', 'not-a-payment'],
  ['reward points', 'VM-HDFCBK', 'You have earned 500 reward points on your spend of Rs 5,000', 'not-a-payment'],
  ['wallet top-up wording', 'VM-PYTMPB', 'Rs.500 added to your Paytm wallet', 'not-a-payment'],

  // ---- balance and account notices
  ['balance alert', 'VM-HDFCBK', 'Available balance in your HDFC Bank a/c XX1234 is Rs 10,000.00 as on 05-Nov-26', 'not-a-payment'],
  ['low balance', 'VM-HDFCBK', 'Alert: balance in a/c XX1234 is below Rs 1,000. Please maintain minimum balance', 'not-a-payment'],
  ['limit increase', 'VM-HDFCBK', 'Your HDFC credit card limit has been increased to Rs 2,00,000', 'not-a-payment'],
  ['debit with only a balance figure', 'VM-HDFCBK', 'Debited from a/c XX1234. Avl Bal Rs.45,000.00', 'no-amount'],
  ['balance after the word "balance" without a colon', 'VM-HDFCBK', 'Your a/c XX1234 has been debited. Balance is Rs 9,000', 'no-amount'],

  // ---- amount problems
  ['zero amount', 'VM-HDFCBK', 'Rs 0.00 debited from a/c XX1234', 'no-amount'],
  ['no amount at all', 'VM-HDFCBK', 'Your a/c XX1234 has been debited. Call us if not you.', 'no-amount'],
  ['absurdly large amount', 'VM-HDFCBK', 'Rs.99,99,99,99,999.00 debited from a/c XX1234', 'no-amount'],
  ['not a number after Rs', 'VM-HDFCBK', 'Rs. debited from a/c XX1234 on 05-11-26', 'no-amount'],

  // ---- foreign currency: never read as rupees
  ['USD, balance in rupees', 'VM-HDFCBK', 'Spent USD 25.00 On HDFC Bank CREDIT Card xx4321 At OPENAI On 2026-11-05:10:11:12. Avl Lim Rs.90,000.00', 'no-amount'],
  ['USD first, limit in INR', 'VM-ICICIB', 'USD 25.00 spent using ICICI Bank Card XX4321 on 05-Nov-26 on OPENAI. Avl Limit: INR 98,766.00', 'no-amount'],
  ['EUR', 'VM-SBICRD', 'Spent EUR 12.50 on SBI Credit Card ending 4321 at BOOKING.COM on 05/11/26', 'no-amount'],
  ['dollar sign', 'VM-AXISBK', '$12.50 spent on Axis Bank Card no. XX4828 05-11-26 12:00:00 IST GITHUB Avl Limit: INR 169365', 'no-amount'],
  ['Amex in USD', 'VM-AMEXIN', "Alert: You've spent USD 25.00 on your AMEX card ** 41005 at OPENAI on 5 November 2026 at 10:15 PM IST.", 'no-amount'],

  // ---- not a payment at all
  ['chat', 'VM-HDFCBK', 'Hi! Meet at 5pm?', 'not-a-payment'],
  ['empty', 'VM-HDFCBK', '', 'not-a-payment'],
  ['whitespace only', 'VM-HDFCBK', '  \n  ', 'not-a-payment'],
  ['BoB "Dr./Cr." shorthand: a KNOWN GAP, skipped on purpose (a missed message, not a wrong one)', 'VM-BOBSMS', 'Rs.500.00 Dr. from A/c XXXXXX1234 and Cr. to testmerchant@upi. Ref:312345678916. AvlBal:Rs5000 (BOB)', 'not-a-payment'],
]

const isWant = (w: Row[3]): w is Want => typeof w === 'object'
const outRows = OUT
const skipRows = NOT_OFFERED

describe('formats table: money out is offered, with the right fields', () => {
  it.each(outRows)('%s', (_label, sender, body, want) => {
    const r = parseSms(body, sender)
    if (!r.ok) throw new Error(`was skipped (${r.reason})`)
    const w = want as Want
    expect(r.amount).toBe(w.amount)
    if (w.last4 !== undefined) expect(r.last4).toBe(w.last4)
    if (w.mode !== undefined) expect(r.mode).toBe(w.mode)
    if (w.kind !== undefined) expect(r.kind).toBe(w.kind)
    if (w.bank !== undefined) expect(r.bank).toBe(w.bank)
    if (w.source !== undefined) expect(r.source).toBe(w.source)
    if (typeof w.merchant === 'string') expect(r.merchant).toBe(w.merchant)
    else if (w.merchant) expect(r.merchant).toMatch(w.merchant)
  })
})

describe('formats table: anything else fails closed (not offered)', () => {
  it.each(skipRows)('%s', (_label, sender, body, want) => {
    const r = parseSms(body, sender)
    if (r.ok) throw new Error(`was OFFERED as ${r.amount} ${r.kind}`)
    if (want !== 'skip') expect(r.reason).toBe(want)
  })
})

describe('formats table: whole-pipeline invariants', () => {
  const day = new Date(2026, 10, 5, 12).getTime()
  const feed = (rows: Row[]) => buildCandidates(rows.map((r, i) => ({ id: String(i), address: r[1], date: day, body: r[2] })), starterBudget(), () => null)

  it('no skipped row ever reaches the review list, even all together', () => {
    expect(feed(skipRows).found).toEqual([])
  })
  it('every offered amount is positive, plain digits with at most two decimals, and in range', () => {
    for (const [label, sender, body] of outRows) {
      const r = parseSms(body, sender)
      if (!r.ok) throw new Error(`${label}: skipped`)
      expect(r.amount, label).toMatch(/^[1-9]\d{0,8}(\.\d{2})?$|^0\.\d[1-9]$|^0\.[1-9]\d$/)
    }
  })
  it('the payee never contains a phone-number or reference-sized digit run, or a URL scheme', () => {
    for (const [label, sender, body] of outRows) {
      const r = parseSms(body, sender)
      if (r.ok) {
        expect(r.merchant, label).not.toMatch(/\d{9,}/)
        expect(r.merchant, label).not.toMatch(/https?:/i)
      }
    }
  })
  it('the table covers all fifteen banks the owner listed', () => {
    const seen = new Set(outRows.map((r) => (isWant(r[3]) ? r[3].bank : undefined)).filter(Boolean))
    for (const b of ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank', 'IDFC First Bank', 'Yes Bank', 'Punjab National Bank', 'Bank of Baroda', 'Canara Bank', 'IndusInd Bank', 'Federal Bank', 'AU Small Finance Bank', 'Paytm Payments Bank', 'American Express']) {
      expect(seen.has(b), b).toBe(true)
    }
  })
})
