import axios from 'axios';

const API_URL = 'https://mobvalor-api.onrender.com';
const token = 'eyJkZWFsZXJJZCI6ImRkOTAwYzllLWNiN2UtNDI5Zi04NTVjLTlhMzhmZWJjNzIxNyJ9';
const dealerId = 'dd900c9e-cb7e-429f-855c-9a38febc7217';

axios.post(`${API_URL}/api/consultas/completa`,
  {
    dealerId: dealerId,
    placa: 'ABC1234'
  },
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
).then(res => {
  console.log('✅ Sucesso!');
  console.log(JSON.stringify(res.data, null, 2));
}).catch(err => {
  console.error('❌ Erro:');
  console.error(err.response?.data || err.message);
});
