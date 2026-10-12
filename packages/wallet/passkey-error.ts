// SDK errors can contain sensitive native details; expose only known codes.
export function passkeyFailureMessage(error:unknown):string {
  let current=error;
  for(let depth=0;depth<4&&current&&typeof current==='object';depth++){
    const value=current as {code?:unknown;error?:unknown;cause?:unknown};
    // react-native-passkey rejects with {error, message}; Mera wraps that
    // object as its cause, while other clients expose {code}.
    switch(typeof value.code==='string'?value.code:value.error){
      case 'PRF_UNAVAILABLE': return 'Provider passkey belum mendukung PRF. Pilih provider yang mendukung PRF lalu coba lagi.';
      case 'NoCreateOption': case 'NotConfigured': return 'Provider belum dapat membuat passkey. Aktifkan provider dan akunnya di pengaturan passkey Android.';
      case 'NoCredentials': return 'Passkey wallet ini tidak ditemukan. Pilih provider tempat passkey lu disimpan.';
      case 'UserCancelled': return 'Permintaan passkey dibatalkan. Sesi wallet belum dibuka.';
      case 'NotSupported': return 'Passkey belum didukung pada konfigurasi ini. Periksa provider dan versi Android.';
      case 'TimedOut': case 'Interrupted': return 'Permintaan passkey terhenti. Coba lagi setelah provider siap.';
    }
    current=value.cause;
  }
  return 'Passkey belum berhasil. Periksa provider dan koneksi, lalu coba lagi.';
}
