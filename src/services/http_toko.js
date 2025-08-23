const axios = require('axios');
require('dotenv').config();

const tokoVoucher = {
  memberCode: process.env.member_code,
  signature: process.env.signature,
  secret : process.env.secret,
};
  /**
   * Helper function to generate TokoVoucher API URL
   * @param {string} memberCode
   * @param {string} signature
   * @param {string} endpoint
   * @param {object} params
   * @returns {string}
   */
  const generateUrl = (memberCode, signature, endpoint, params = {}) => {
        const urlParams = new URLSearchParams({
            member_code: memberCode,
           signature: signature,
          ...params
       });

        return `https://api.tokovoucher.id/member/${endpoint}?${urlParams}`;
    };

   /**
     * Fetches the list of product categories from TokoVoucher API.
     * @returns {Promise<any[]>}
     */
    async function getKategori() {
          const { memberCode, signature } = tokoVoucher;
          const url = generateUrl(memberCode, signature, 'produk/category/list');
         try {
           const response = await axios.get(url);
           return response.data.data;
         } catch (error) {
            console.error('Error fetching categories:', error);
            throw error;
         }
    }
     /**
     * Finds a category ID by its name from TokoVoucher API.
     * @param {string} name
     * @returns {Promise<string|undefined>}
     */
     async function findIdByName(name) {
      try {
           const categories = await getKategori();
            const category = categories.find(category => category.nama === name);
             return category ? category.id : undefined;
        } catch (error) {
            console.error(`Error finding category ID by name ${name}:`, error);
              throw error;
        }
    }
    /**
     * Fetches the list of operators for a given category from TokoVoucher API.
     * @param {string} categoryId
     * @returns {Promise<any[]>}
     */
    async function getOperatorByCategory(categoryId) {
        const { memberCode, signature } = tokoVoucher;
       const url = generateUrl(memberCode, signature, 'produk/operator/list', { id: categoryId });
        try {
             const response = await axios.get(url);
            return response.data.data;
          } catch (error) {
            console.error(`Error fetching operators for category ID ${categoryId}:`, error);
            throw error;
         }
    }
    /**
     * Finds an operator ID by its name and category ID from TokoVoucher API.
     * @param {string} name
     * @param {string} categoryId
     * @returns {Promise<string|undefined>}
     */
    async function findIdOperatorByName(name, categoryId) {
       try {
            const operators = await getOperatorByCategory(categoryId);
            const operator = operators.find(operator => operator.nama === name);
             return operator ? operator.id : undefined;
       } catch (error) {
          console.error(`Error finding operator ID by name ${name} and category ID ${categoryId}:`, error);
         throw error;
       }
    }
    /**
     * Fetches the list of product types for a given operator from TokoVoucher API.
     * @param {string} operatorId
     * @returns {Promise<any[]>}
     */
      async function getJenis(operatorId) {
          const { memberCode, signature } = tokoVoucher;
          const url = generateUrl(memberCode, signature, 'produk/jenis/list', { id: operatorId });
        try {
             const response = await axios.get(url);
           const sortedData = response.data.data.sort((a, b) => a.price - b.price);
           return sortedData;
       } catch (error) {
           console.error(`Error fetching product types for operator ID ${operatorId}:`, error);
           throw error;
       }
     }
    /**
     * Finds a product type ID by its name and operator ID from TokoVoucher API.
     * @param {string} name
     * @param {string} operatorId
     * @returns {Promise<string|undefined>}
     */
    async function findIdJenisByName(name, operatorId) {
      try {
            const productTypes = await getJenis(operatorId);
             const productType = productTypes.find(item => item.nama === name);
            return productType ? productType.id : undefined;
        } catch (error) {
          console.error(`Error finding product type ID by name ${name} and operator ID ${operatorId}:`, error);
           throw error;
        }
   }
     /**
     * Fetches the list of products for a given product type from TokoVoucher API.
     * @param {string} productTypeId
     * @returns {Promise<any[]>}
     */
     async function getListJenis(productTypeId) {
         const { memberCode, signature } = tokoVoucher;
        const url = generateUrl(memberCode, signature, 'produk/list', { id_jenis: productTypeId });
       try {
         const response = await axios.get(url);
         const sortedData = response.data.data.sort((a, b) => a.price - b.price);
         return sortedData;
      } catch (error) {
         console.error(`Error fetching product list for product type ID ${productTypeId}:`, error);
            throw error;
       }
   }
    /**
     * Finds a product code by its name and product type ID from TokoVoucher API.
     * @param {string} name
     * @param {string} productTypeId
     * @returns {Promise<string|undefined>}
     */
     async function findIdListJenisByName(name, productTypeId) {
      try {
        const products = await getListJenis(productTypeId);
        const product = products.find((item) => item.nama_produk === name);
          return product ? product.code : undefined;
       }
       catch (error) {
            console.error(`Error finding product code by name ${name} and product type ID ${productTypeId}:`, error);
            throw error;
        }
    }
     /**
     * Generates a unique reference ID.
     * @returns {string}
     */
    function getRefId() {
        return `REF${Date.now()}WAYAN`;
    }
    /**
     * Creates a transaction with TokoVoucher API.
     * @param {string} refId
     * @param {string} productCode
     * @param {string} destinationNumber
     * @param {string} serverId
     * @returns {Promise<any>}
     */
    async function createTrx(refId, productCode, destinationNumber, serverId = "") {
       const { secret, memberCode } = tokoVoucher;
      const url = `https://api.tokovoucher.id/v1/transaksi?ref_id=${refId}&produk=${productCode}&tujuan=${destinationNumber}&secret=${secret}&member_code=${memberCode}&server_id=${serverId}`;
      try {
          const response = await axios.get(url);
            return response.data;
      } catch (error) {
            console.error('Error creating transaction:', error);
            throw error;
      }
  }
   /**
     * Fetches account balance from TokoVoucher API.
     * @returns {Promise<number>}
     */
    async function checkSaldo() {
        const { memberCode, signature } = tokoVoucher;
        const url = `https://api.tokovoucher.id/member?member_code=${memberCode}&signature=${signature}`;
       try {
             const response = await axios.get(url);
             const { data } = response;
                if(data.status !== 1){
                    throw new Error(`Error !! : ${data.error_msg}`);
                }
             return data.data.saldo;
        } catch (error) {
            console.error('Error checking balance:', error.message);
            throw error;
      }
  }

    /**
    * Helper function to format number with commas for thousands separator
    * @param {number} x
    * @returns {string}
    */
function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

module.exports = {
  ...tokoVoucher,
    getKategori,
    findIdByName,
    getOperatorByCategory,
    findIdOperatorByName,
    getJenis,
    findIdJenisByName,
    getListJenis,
    findIdListJenisByName,
    getRefId,
    createTrx,
    checkSaldo,
    numberWithCommas
};