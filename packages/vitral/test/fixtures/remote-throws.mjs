// Remote cujo mount sempre lança (testes de MOUNT_FAILED).
export default {
  mount() {
    throw new Error('quebrou no mount')
  },
}
